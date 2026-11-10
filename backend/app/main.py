from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from . import models
from .config import settings
from .database import Base, engine, get_db
from .schemas import DocumentDetail, DocumentListItem
from .services import extract_text, summarize_text

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="AI Document Analyzer API",
    version="1.0.0",
    description="Extract PDF/TXT text, summarize it with OpenAI, and save history in PostgreSQL.",
    lifespan=lifespan,
)

@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")

@app.get("/documents", response_model=list[DocumentListItem])
def list_documents(db: Session = Depends(get_db)):
    return db.query(models.Document).order_by(models.Document.created_at.desc()).all()

@app.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@app.post("/documents/upload", response_model=DocumentDetail, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = Path(file.filename or "document").name
    if Path(filename).suffix.lower() not in {".pdf", ".txt"}:
        raise HTTPException(status_code=415, detail="Only PDF and TXT files are supported.")

    content = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_mb} MB limit.")

    extracted = extract_text(filename, content)
    summary = summarize_text(extracted)

    document = models.Document(
        filename=filename,
        content_type=file.content_type or "application/octet-stream",
        extracted_text=extracted,
        summary=summary,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document
