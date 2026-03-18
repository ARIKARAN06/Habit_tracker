import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import date
from dotenv import load_dotenv

import models, schemas
from database import engine, get_db

load_dotenv()
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Daily Habit Tracker API")

# Setup CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Habit Tracker API"}

@app.post("/habits/", response_model=schemas.Habit)
def create_habit(habit: schemas.HabitCreate, db: Session = Depends(get_db)):
    db_habit = models.Habit(title=habit.title)
    db.add(db_habit)
    db.commit()
    db.refresh(db_habit)
    return db_habit

@app.get("/habits/", response_model=list[schemas.Habit])
def read_habits(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    habits = db.query(models.Habit).filter(models.Habit.is_active == True).offset(skip).limit(limit).all()
    return habits

@app.post("/logs/", response_model=schemas.HabitLog)
def toggle_habit_log(log: schemas.HabitLogCreate, db: Session = Depends(get_db)):
    existing_log = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == log.habit_id,
        models.HabitLog.date == log.date
    ).first()
    
    if existing_log:
        existing_log.completed = log.completed
        db.commit()
        db.refresh(existing_log)
        return existing_log
    else:
        new_log = models.HabitLog(habit_id=log.habit_id, date=log.date, completed=log.completed)
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        return new_log

@app.get("/logs/{target_date}", response_model=list[schemas.HabitLog])
def get_logs_by_date(target_date: str, db: Session = Depends(get_db)):
    return db.query(models.HabitLog).filter(models.HabitLog.date == target_date).all()

@app.get("/logs_all/", response_model=list[schemas.HabitLog])
def get_all_logs(db: Session = Depends(get_db)):
    return db.query(models.HabitLog).all()

@app.delete("/habits/{habit_id}")
def delete_habit(habit_id: int, db: Session = Depends(get_db)):
    habit = db.query(models.Habit).filter(models.Habit.id == habit_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    # Delete associated logs first
    db.query(models.HabitLog).filter(models.HabitLog.habit_id == habit_id).delete()
    db.delete(habit)
    db.commit()
    return {"message": "Habit deleted"}
@app.get("/stats/")
def get_user_stats(db: Session = Depends(get_db)):
    # Very basic streak and consistency calculation
    # In a real app, this would iterate over past days dynamically
    # Here we'll just mock a consistency score based on recent logs for demo purposes
    total_habits = db.query(models.Habit).filter(models.Habit.is_active == True).count()
    if total_habits == 0:
        return {"streak": 0, "consistency": 0}
        
    logs = db.query(models.HabitLog).all()
    completed_logs = [log for log in logs if log.completed]
    
    # Simple consistency: (completed / (total_habits * days_tracked)) * 100
    # For now, we'll just assume a fixed consistency based on raw logs
    consistency = int((len(completed_logs) / max((total_habits * 7), 1)) * 100)
    consistency = min(consistency, 100) # Cap at 100%
    
    streak = len(completed_logs) // total_habits if total_habits > 0 else 0
    return {"streak": streak, "consistency": consistency}

from ai_coach import get_chat_response

@app.post("/chat/")
def chat_with_coach(request: schemas.ChatRequest, db: Session = Depends(get_db)):
    active_habits = db.query(models.Habit).filter(models.Habit.is_active == True).all()
    logs = db.query(models.HabitLog).filter(models.HabitLog.date == request.target_date).all()
    
    completed_habit_ids = [log.habit_id for log in logs if log.completed]
    
    completed_titles = []
    missed_titles = []
    
    for h in active_habits:
        if h.id in completed_habit_ids:
            completed_titles.append(h.title)
        else:
            missed_titles.append(h.title)
    
    # Convert pydantic models to dicts for Groq API
    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    
    reply = get_chat_response(messages, completed_titles, missed_titles)
    return {"reply": reply}
