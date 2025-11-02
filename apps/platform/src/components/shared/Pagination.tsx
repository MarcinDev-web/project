import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  total,
  onPageChange,
}: PaginationProps) {
  const startItem = totalPages > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, total);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  if (totalPages <= 1) {
    return null; // Don't show pagination if only one page
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--spacing-4)',
        marginTop: 'var(--spacing-6)',
        padding: 'var(--spacing-4)',
        background: 'var(--bg-button)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
        Showing {startItem}-{endItem} of {total} items
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
        <Button
          variant="secondary"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          style={{ minWidth: 'auto', padding: 'var(--spacing-2) var(--spacing-3)' }}
        >
          « First
        </Button>
        <Button
          variant="secondary"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{ minWidth: 'auto', padding: 'var(--spacing-2) var(--spacing-3)' }}
        >
          ‹ Prev
        </Button>

        <div style={{ display: 'flex', gap: 'var(--spacing-1)', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <Button
          variant="secondary"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{ minWidth: 'auto', padding: 'var(--spacing-2) var(--spacing-3)' }}
        >
          Next ›
        </Button>
        <Button
          variant="secondary"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          style={{ minWidth: 'auto', padding: 'var(--spacing-2) var(--spacing-3)' }}
        >
          Last »
        </Button>
      </div>
    </div>
  );
}

