import type { StrapiQueryOptions } from './types';

export function buildStrapiQueryString(options: StrapiQueryOptions): string {
  const params = new URLSearchParams();

  if (options.populate) {
    if (typeof options.populate === 'string') {
      params.append('populate', options.populate);
    } else if (Array.isArray(options.populate)) {
      options.populate.forEach((p, i) => params.append(`populate[${i}]`, p));
    } else {
      const flattenPopulate = (obj: Record<string, unknown>, prefix = 'populate'): void => {
        for (const [key, value] of Object.entries(obj)) {
          if (Array.isArray(value)) {
            value.forEach((item, i) => params.append(`${prefix}[${key}][${i}]`, String(item)));
          } else if (typeof value === 'object' && value !== null) {
            flattenPopulate(value as Record<string, unknown>, `${prefix}[${key}]`);
          } else {
            params.append(`${prefix}[${key}]`, String(value));
          }
        }
      };
      flattenPopulate(options.populate);
    }
  }

  if (options.filters) {
    const flattenFilters = (obj: Record<string, unknown>, prefix = 'filters'): void => {
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          value.forEach((item, i) => {
            if (typeof item === 'object' && item !== null) {
              flattenFilters(item as Record<string, unknown>, `${prefix}[${key}][${i}]`);
            } else {
              params.append(`${prefix}[${key}][${i}]`, String(item));
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          flattenFilters(value as Record<string, unknown>, `${prefix}[${key}]`);
        } else {
          params.append(`${prefix}[${key}]`, String(value));
        }
      }
    };
    flattenFilters(options.filters);
  }

  if (options.sort) {
    if (typeof options.sort === 'string') {
      params.append('sort', options.sort);
    } else {
      options.sort.forEach((s, i) => params.append(`sort[${i}]`, s));
    }
  }

  if (options.pagination) {
    if (options.pagination.page !== undefined) {
      params.append('pagination[page]', String(options.pagination.page));
    }
    if (options.pagination.pageSize !== undefined) {
      params.append('pagination[pageSize]', String(options.pagination.pageSize));
    }
    if (options.pagination.limit !== undefined) {
      params.append('pagination[limit]', String(options.pagination.limit));
    }
  }

  if (options.fields) {
    options.fields.forEach((f, i) => params.append(`fields[${i}]`, f));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}
