from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class HabitBase(BaseModel):
    title: str

class HabitCreate(HabitBase):
    pass

class Habit(HabitBase):
    id: int
    created_at: datetime
    is_active: bool

    class Config:
        orm_mode = True

class HabitLogBase(BaseModel):
    habit_id: int
    date: str
    completed: bool

class HabitLogCreate(HabitLogBase):
    pass

class HabitLog(HabitLogBase):
    id: int

    class Config:
        orm_mode = True

class CoachRequest(BaseModel):
    target_date: str # Optional or focus date

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    target_date: str
