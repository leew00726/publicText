from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Employee
from app.schemas import AuthLoginRequest, AuthLoginResponse
from app.services.passwords import verify_password


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=AuthLoginResponse)
def login(payload: AuthLoginRequest, db: Session = Depends(get_db)):
    employee_no = payload.username.strip()
    employee = db.query(Employee).filter(Employee.employee_no == employee_no, Employee.is_active.is_(True)).first()
    if not employee or not verify_password(payload.password, employee.password_hash):
        raise HTTPException(status_code=401, detail="工号或密码错误")
    if not employee.company_id or not employee.company_name:
        raise HTTPException(status_code=503, detail="员工未绑定所属公司，请联系管理员")

    return AuthLoginResponse(
        employeeNo=employee.employee_no,
        name=employee.name,
        role=employee.role,
        companyId=employee.company_id,
        companyName=employee.company_name,
    )
