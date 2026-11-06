"""衣物照片改为选填

items.image_key 允许为空；没有照片的衣物在前端显示按部位、类型和主色生成的占位剪影。

Revision ID: c61f0b8e2d47
Revises: a4d7e2f19c63
Create Date: 2026-11-07 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c61f0b8e2d47'
down_revision: Union[str, Sequence[str], None] = 'a4d7e2f19c63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('items') as batch_op:
        batch_op.alter_column('image_key', existing_type=sa.String(length=64), nullable=True)


def downgrade() -> None:
    # 旧版本要求每件衣物都有照片，没有照片的衣物无法保留，降级时会被删除
    op.execute('DELETE FROM items WHERE image_key IS NULL')
    with op.batch_alter_table('items') as batch_op:
        batch_op.alter_column('image_key', existing_type=sa.String(length=64), nullable=False)
