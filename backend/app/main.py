from fastapi import FastAPI
from app.users import router as users_router

app = FastAPI()

app.include_router(users_router)

@app.get("/")
def read_root():
    return {"msg": "Fitness Tracker API is running!"}
