import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

/** « Page 2 sur 5 » with « Précédent » and « Suivant ». Nothing when everything fits on one page. */
export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <p className="text-base text-muted-foreground">
        Page {page} sur {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft aria-hidden /> Précédent
        </Button>
        <Button variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Suivant <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
