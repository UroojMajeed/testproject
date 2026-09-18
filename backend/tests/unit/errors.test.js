import { describe, it, expect } from 'vitest';
import { ApiError } from '../../src/utils/ApiError.js';
import { parsePagination, pageMeta } from '../../src/utils/paginate.js';
import { ROLE_RANK } from '../../src/config/constants.js';

describe('ApiError', () => {
  it.each([
    ['badRequest', 400, 'VALIDATION_ERROR'],
    ['unauthenticated', 401, 'UNAUTHENTICATED'],
    ['forbidden', 403, 'FORBIDDEN'],
    ['notFound', 404, 'NOT_FOUND'],
    ['conflict', 409, 'CONFLICT'],
    ['unprocessable', 422, 'VALIDATION_ERROR'],
    ['locked', 423, 'ACCOUNT_LOCKED'],
  ])('%s carries status %i and code %s', (fn, status, code) => {
    const err = ApiError[fn]('message');
    expect(err.statusCode).toBe(status);
    expect(err.code).toBe(code);
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });

  it('carries field details when given them', () => {
    const err = ApiError.unprocessable('nope', [{ field: 'body.email', message: 'required' }]);
    expect(err.details).toHaveLength(1);
  });
});

describe('parsePagination', () => {
  it('defaults sensibly', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 25, skip: 0 });
  });

  it('computes skip from page and limit', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('clamps a limit that would dump the collection', () => {
    expect(parsePagination({ limit: '100000' }).limit).toBe(100);
  });

  it('refuses page zero and negatives', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1);
    expect(parsePagination({ page: '-5' }).page).toBe(1);
  });

  it('ignores junk', () => {
    expect(parsePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 25, skip: 0 });
  });

  it('reports at least one page even when empty', () => {
    expect(pageMeta({ page: 1, limit: 25 }, 0).totalPages).toBe(1);
  });
});

describe('role ranking', () => {
  it('orders owner above manager above member', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.manager);
    expect(ROLE_RANK.manager).toBeGreaterThan(ROLE_RANK.member);
  });
});
