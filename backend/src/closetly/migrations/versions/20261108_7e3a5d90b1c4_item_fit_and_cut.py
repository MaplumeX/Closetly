"""衣物增加版型和廓形

items.fit 表示松量，items.cut 表示廓形，都是选填；存量衣物保持为空。

Revision ID: 7e3a5d90b1c4
Revises: c61f0b8e2d47
Create Date: 2026-11-08 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7e3a5d90b1c4'
down_revision: Union[str, Sequence[str], None] = 'c61f0b8e2d47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('items') as batch_op:
        batch_op.add_column(sa.Column('fit', sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column('cut', sa.String(length=16), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('items') as batch_op:
        batch_op.drop_column('cut')
        batch_op.drop_column('fit')
