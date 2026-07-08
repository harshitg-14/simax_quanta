from pydantic import BaseModel, EmailStr
from typing import Literal


class UserRegister(BaseModel):
    name:     str
    email:    str
    password: str
    role:     Literal["admin", "department_officer", "auditor", "reviewer"] = "department_officer"


class UserLogin(BaseModel):
    email:    str
    password: str
