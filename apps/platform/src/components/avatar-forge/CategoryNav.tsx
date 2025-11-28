/**
 * CategoryNav - Vertical navigation sidebar for avatar categories
 */

import { memo } from 'react';
import { AVATAR_CATEGORIES, type AvatarCategory } from './types';

export interface CategoryNavProps {
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

/**
 * Vertical category navigation component
 */
export const CategoryNav = memo(function CategoryNav({
  activeCategory,
  onCategoryChange,
}: CategoryNavProps) {
  return (
    <nav className="category-nav" role="navigation" aria-label="Avatar categories">
      {AVATAR_CATEGORIES.map((category) => (
        <CategoryButton
          key={category.id}
          category={category}
          isActive={activeCategory === category.id}
          onClick={() => onCategoryChange(category.id)}
        />
      ))}
    </nav>
  );
});

interface CategoryButtonProps {
  category: AvatarCategory;
  isActive: boolean;
  onClick: () => void;
}

const CategoryButton = memo(function CategoryButton({
  category,
  isActive,
  onClick,
}: CategoryButtonProps) {
  return (
    <button
      className={`category-nav__item ${isActive ? 'category-nav__item--active' : ''}`}
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={category.label}
      title={category.label}
    >
      <span className="category-nav__icon" aria-hidden="true">
        {category.icon}
      </span>
      <span className="category-nav__label">{category.label}</span>
    </button>
  );
});

