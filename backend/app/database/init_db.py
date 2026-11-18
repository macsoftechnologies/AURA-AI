from app.database.connection import Base, engine
from app.models.user import User
from app.models.rag import UserDocument, DocumentChunk


def create_tables():
    Base.metadata.create_all(bind=engine)
    print("AURA AI database tables created successfully!")


if __name__ == "__main__":
    create_tables()