from datetime import date
from pydantic import BaseModel, Field, ConfigDict

class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    position: str = Field(min_length=2, max_length=120)
    department: str = Field(default="Общий отдел", max_length=120)
    email: str = Field(min_length=5, max_length=180)
    hired_at: date | None = None

class EmployeeOut(EmployeeCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

class VacancyCreate(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    department: str = Field(default="Общий отдел", max_length=120)
    description: str = ""
    status: str = "Открыта"

class VacancyOut(VacancyCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int

class LeaveCreate(BaseModel):
    employee_name: str = Field(min_length=2, max_length=160)
    start_date: date
    end_date: date
    reason: str = ""

class LeaveOut(LeaveCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
