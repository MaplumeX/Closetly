"""全站设置

新增 app_settings 键值表，目前用于存放「是否开放注册」。

Revision ID: a4d7e2f19c63
Revises: 3b7e9c41d2a8
Create Date: 2026-11-06 22:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a4d7e2f19c63'
down_revision: Union[str, Sequence[str], None] = '3b7e9c41d2a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'app_settings',
        sa.Column('key', sa.String(length=64), nullable=False),
        sa.Column('value', sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )


def downgrade() -> None:
    op.drop_table('app_settings')
