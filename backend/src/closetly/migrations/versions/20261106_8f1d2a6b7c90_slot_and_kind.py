"""分类改为固定部位 + 用户自定义类型

把全局共用的两级分类表拆掉：一级分类变成衣物上的 slot（固定枚举），
二级分类的名称变成衣物上的 kind（用户自由填写的文字）。

Revision ID: 8f1d2a6b7c90
Revises: 5c29c3200332
Create Date: 2026-11-06 18:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8f1d2a6b7c90'
down_revision: Union[str, Sequence[str], None] = '5c29c3200332'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SLOT = sa.Enum('top', 'bottom', 'onepiece', 'outer', 'shoes', 'accessory', name='slot', native_enum=False, length=16)
SLOT_NAMES = [
    ('top', '上装'), ('bottom', '下装'), ('onepiece', '连衣裙/连体'),
    ('outer', '外套'), ('shoes', '鞋'), ('accessory', '配饰'),
]  # fmt: skip


def upgrade() -> None:
    with op.batch_alter_table('items') as batch_op:
        batch_op.add_column(sa.Column('slot', SLOT, nullable=True))
        batch_op.add_column(sa.Column('kind', sa.String(length=32), nullable=True))

    # 一级分类上记着 slot；衣物挂在二级分类上时，二级分类名就是类型
    op.execute("""
        UPDATE items SET
          slot = (SELECT COALESCE(p.slot, c.slot) FROM categories c
                  LEFT JOIN categories p ON p.id = c.parent_id WHERE c.id = items.category_id),
          kind = (SELECT CASE WHEN c.parent_id IS NOT NULL THEN substr(c.name, 1, 32) END
                  FROM categories c WHERE c.id = items.category_id)
    """)
    op.execute("UPDATE items SET slot = 'accessory' WHERE slot IS NULL")  # 兜底，正常不会出现

    with op.batch_alter_table('items') as batch_op:
        batch_op.alter_column('slot', existing_type=SLOT, nullable=False)
        batch_op.drop_column('category_id')
        batch_op.create_index('ix_items_user_slot_kind', ['user_id', 'slot', 'kind'], unique=False)

    with op.batch_alter_table('categories') as batch_op:
        batch_op.drop_index('ix_categories_parent_id')
    op.drop_table('categories')


def downgrade() -> None:
    categories = op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('slot', SLOT, nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['parent_id'], ['categories.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('parent_id', 'name'),
    )
    with op.batch_alter_table('categories') as batch_op:
        batch_op.create_index('ix_categories_parent_id', ['parent_id'], unique=False)

    # 每个部位一个一级分类，所有用户用过的类型作为二级分类
    op.bulk_insert(categories, [
        {'id': i + 1, 'parent_id': None, 'name': name, 'slot': slot, 'sort_order': i}
        for i, (slot, name) in enumerate(SLOT_NAMES)
    ])
    op.execute("""
        INSERT INTO categories (parent_id, name, slot, sort_order)
        SELECT p.id, k.kind, NULL, 0
        FROM (SELECT DISTINCT slot, kind FROM items WHERE kind IS NOT NULL) k
        JOIN categories p ON p.parent_id IS NULL AND p.slot = k.slot
    """)

    with op.batch_alter_table('items') as batch_op:
        batch_op.drop_index('ix_items_user_slot_kind')
        batch_op.add_column(sa.Column('category_id', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE items SET category_id = COALESCE(
          (SELECT c.id FROM categories c JOIN categories p ON p.id = c.parent_id
           WHERE p.slot = items.slot AND c.name = items.kind),
          (SELECT p.id FROM categories p WHERE p.parent_id IS NULL AND p.slot = items.slot))
    """)
    with op.batch_alter_table('items') as batch_op:
        batch_op.alter_column('category_id', existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key('fk_items_category_id', 'categories', ['category_id'], ['id'], ondelete='RESTRICT')
        batch_op.drop_column('kind')
        batch_op.drop_column('slot')
