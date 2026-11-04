import json
from datetime import date
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func, text
from redis import Redis
from .database import Base, engine, get_db
from . import models, schemas
import os
from prometheus_fastapi_instrumentator import Instrumentator
app = FastAPI(title="HR-system API", version="1.0.0")
Instrumentator().instrument(app).expose(app)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
redis_client = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=True)

@app.on_event("startup")
def startup():
    # Create all required tables automatically on first deployment.
    # Serialize first-start schema creation when both API replicas boot together.
    with engine.begin() as connection:
        connection.execute(text("SELECT pg_advisory_xact_lock(987654321)"))
        Base.metadata.create_all(bind=connection)

def publish_event(event: dict):
    try:
        redis_client.rpush("hr:events", json.dumps(event, ensure_ascii=False))
    except Exception:
        # Main HR operation remains available if the optional event queue is unavailable.
        pass

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    return {
        "employees": db.scalar(select(func.count()).select_from(models.Employee)) or 0,
        "vacancies": db.scalar(select(func.count()).select_from(models.Vacancy).where(models.Vacancy.status == "Открыта")) or 0,
        "leave_requests": db.scalar(select(func.count()).select_from(models.LeaveRequest).where(models.LeaveRequest.status == "На рассмотрении")) or 0,
    }

@app.get("/api/employees", response_model=list[schemas.EmployeeOut])
def employees(db: Session = Depends(get_db)):
    return db.scalars(select(models.Employee).order_by(models.Employee.id.desc())).all()

@app.post("/api/employees", response_model=schemas.EmployeeOut, status_code=201)
def create_employee(payload: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    if db.scalar(select(models.Employee).where(models.Employee.email == payload.email)):
        raise HTTPException(409, "Сотрудник с таким email уже существует")
    data = payload.model_dump(exclude_none=True)
    employee = models.Employee(**data)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    publish_event({"type": "employee.created", "id": employee.id, "name": employee.full_name})
    return employee

@app.get("/api/vacancies", response_model=list[schemas.VacancyOut])
def vacancies(db: Session = Depends(get_db)):
    return db.scalars(select(models.Vacancy).order_by(models.Vacancy.id.desc())).all()

@app.post("/api/vacancies", response_model=schemas.VacancyOut, status_code=201)
def create_vacancy(payload: schemas.VacancyCreate, db: Session = Depends(get_db)):
    vacancy = models.Vacancy(**payload.model_dump())
    db.add(vacancy)
    db.commit()
    db.refresh(vacancy)
    publish_event({"type": "vacancy.created", "id": vacancy.id, "title": vacancy.title})
    return vacancy

@app.patch("/api/vacancies/{vacancy_id}", response_model=schemas.VacancyOut)
def update_vacancy(vacancy_id: int, status: str, db: Session = Depends(get_db)):
    vacancy = db.get(models.Vacancy, vacancy_id)
    if not vacancy:
        raise HTTPException(404, "Вакансия не найдена")
    if status not in ("Открыта", "Закрыта"):
        raise HTTPException(400, "Недопустимый статус")
    vacancy.status = status
    db.commit()
    db.refresh(vacancy)
    publish_event({"type": "vacancy.updated", "id": vacancy.id, "status": status})
    return vacancy

@app.get("/api/leaves", response_model=list[schemas.LeaveOut])
def leaves(db: Session = Depends(get_db)):
    return db.scalars(select(models.LeaveRequest).order_by(models.LeaveRequest.id.desc())).all()

@app.post("/api/leaves", response_model=schemas.LeaveOut, status_code=201)
def create_leave(payload: schemas.LeaveCreate, db: Session = Depends(get_db)):
    if payload.end_date < payload.start_date:
        raise HTTPException(400, "Дата окончания не может быть раньше даты начала")
    leave = models.LeaveRequest(**payload.model_dump())
    db.add(leave)
    db.commit()
    db.refresh(leave)
    publish_event({"type": "leave.created", "id": leave.id, "employee": leave.employee_name})
    return leave

@app.patch("/api/leaves/{leave_id}", response_model=schemas.LeaveOut)
def update_leave(leave_id: int, status: str, db: Session = Depends(get_db)):
    leave = db.get(models.LeaveRequest, leave_id)
    if not leave:
        raise HTTPException(404, "Заявка не найдена")
    if status not in ("Одобрена", "Отклонена", "На рассмотрении"):
        raise HTTPException(400, "Недопустимый статус")
    leave.status = status
    db.commit()
    db.refresh(leave)
    publish_event({"type": "leave.updated", "id": leave.id, "status": status})
    return leave
