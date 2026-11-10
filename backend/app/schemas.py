from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DocumentListItem(BaseModel):
    id: int
    filename: str
    content_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentDetail(DocumentListItem):
    summary: str
    extracted_text: str
