from sqlalchemy import create_engine, Column, Integer, DateTime, String
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

Base = declarative_base()
engine = create_engine('sqlite:///crowd_data.db', echo=False)
Session = sessionmaker(bind=engine)

class DetectionLog(Base):
    __tablename__ = 'detections'
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.now)
    count = Column(Integer, nullable=False)

class AlertLog(Base):
    __tablename__ = 'alerts'
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.now)
    type = Column(String, nullable=False)
    count = Column(Integer)

def init_db():
    Base.metadata.create_all(engine)
