const express = require('express')

jest.mock('../config/db', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn() },
}))

const recordsRouter = require('../modules/records/records.router')

describe('records dynamic field filters', () => {
  test('extended query parser turns fv bracket notation into a nested object', () => {
    const app = express()
    app.set('query parser', 'extended')

    const parse = app.get('query parser fn')
    expect(parse('fv[vehicle_number][like]=50E&status=new')).toEqual({
      fv: { vehicle_number: { like: '50E' } },
      status: 'new',
    })
  })

  test('buildFvCondition scopes field lookup to selected document types', () => {
    const params = []
    const sql = recordsRouter._private.buildFvCondition(
      'vehicle_number',
      'like',
      '50E',
      params,
      ['11111111-1111-1111-1111-111111111111']
    )

    expect(params).toEqual([
      'vehicle_number',
      ['11111111-1111-1111-1111-111111111111'],
      '%50E%',
    ])
    expect(sql).toContain('field_key = $1')
    expect(sql).toContain('document_type_id = ANY($2::uuid[])')
    expect(sql).toContain('rfv_fv.value_text ILIKE $3')
  })

  test('buildFvCondition ignores unsafe field keys', () => {
    const params = []
    const sql = recordsRouter._private.buildFvCondition(
      'vehicle_number;DROP',
      'like',
      '50E',
      params,
      ['11111111-1111-1111-1111-111111111111']
    )

    expect(sql).toBeNull()
    expect(params).toEqual([])
  })
})
