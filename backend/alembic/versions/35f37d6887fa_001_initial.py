"""001 initial

Revision ID: 35f37d6887fa
Revises: 
Create Date: 2026-09-11 21:55:47.605585

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '35f37d6887fa'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create all tables via Base.metadata for initial setup
    # This is idempotent and works for both SQLite (local) and PostgreSQL (prod)
    from app.core.database import Base
    from app.models.user import User  # noqa: F401
    from app.models.crm import (  # noqa: F401
        Company, Contact, Lead, Deal, Activity, Task, Notification,
        MeetingSummary, AuditLog, Prospect, OutreachResult, OutreachFollowUp, OutreachSendLog,
    )
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    from app.core.database import Base
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
