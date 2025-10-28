import { Region } from './Region'

describe('Region Entity', () => {
  describe('Constructor', () => {
    it('should create region with all properties', () => {
      const region = new Region(
        11,
        'Île-de-France',
        'IDF',
        'Île-de-France',
        500
      )

      expect(region.id).toBe(11)
      expect(region.name).toBe('Île-de-France')
      expect(region.code).toBe('IDF')
      expect(region.fullName).toBe('Île-de-France')
      expect(region.jobCount).toBe(500)
    })

    it('should default jobCount to 0 when not provided', () => {
      const region = new Region(
        84,
        'Auvergne-Rhône-Alpes',
        'ARA',
        'Auvergne-Rhône-Alpes'
      )

      expect(region.jobCount).toBe(0)
    })

    it('should handle regions with no jobs', () => {
      const emptyRegion = new Region(
        1,
        'Guadeloupe',
        'GUA',
        'Guadeloupe',
        0
      )

      expect(emptyRegion.jobCount).toBe(0)
    })

    it('should handle regions with many jobs', () => {
      const popularRegion = new Region(
        11,
        'Île-de-France',
        'IDF',
        'Île-de-France',
        10000
      )

      expect(popularRegion.jobCount).toBe(10000)
    })
  })
})