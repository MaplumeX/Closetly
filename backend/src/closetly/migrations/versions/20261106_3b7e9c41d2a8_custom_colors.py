"""用户自定义颜色

新增 custom_colors 表；衣物的主色可以是预设色（items.color），
也可以是自己添加的颜色（items.custom_color_id）。

Revision ID: 3b7e9c41d2a8
Revises: 8f1d2a6b7c90
Create Date: 2026-11-06 20:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3b7e9c41d2a8'
down_revision: Union[str, Sequence[str], None] = '8f1d2a6b7c90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'custom_colors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=16), nullable=False),
        sa.Column('hex', sa.String(length=7), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name'),
    )
    with op.batch_alter_table('custom_colors') as batch_op:
        batch_op.create_index('ix_custom_colors_user_id', ['user_id'], unique=False)

    with op.batch_alter_table('items') as batch_op:
        batch_op.add_column(sa.Column('custom_color_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_items_custom_color_id', ['custom_color_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_items_custom_color_id', 'custom_colors', ['custom_color_id'], ['id'], ondelete='SET NULL'
        )


def downgrade() -> None:
    # 自定义颜色无法还原成预设色，降级后这些衣物变为未填主色
    with op.batch_alter_table('items') as batch_op:
        batch_op.drop_constraint('fk_items_custom_color_id', type_='foreignkey')
        batch_op.drop_index('ix_items_custom_color_id')
        batch_op.drop_column('custom_color_id')
    with op.batch_alter_table('custom_colors') as batch_op:
        batch_op.drop_index('ix_custom_colors_user_id')
    op.drop_table('custom_colors')
