from sqlalchemy import Column, Integer, String, ForeignKey
from src.core.database import Base

class SyncMapping(Base):
    __tablename__ = "sync_mappings"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    guest_id = Column(String, primary_key=True)
    entity_type = Column(String, primary_key=True)  # 'workout', 'exercise', 'set'
    server_id = Column(Integer, nullable=False)
