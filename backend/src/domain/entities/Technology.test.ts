import { Technology } from './Technology'

describe('Technology Entity', () => {
  describe('Constructor', () => {
    it('should create technology with all properties', () => {
      const tech = new Technology(
        1,
        'React',
        'Frontend',
        'React.js',
        250
      )

      expect(tech.id).toBe(1)
      expect(tech.name).toBe('React')
      expect(tech.category).toBe('Frontend')
      expect(tech.displayName).toBe('React.js')
      expect(tech.jobCount).toBe(250)
    })

    it('should default jobCount to 0 when not provided', () => {
      const tech = new Technology(
        2,
        'Vue',
        'Frontend',
        'Vue.js'
      )

      expect(tech.jobCount).toBe(0)
    })
  })

  describe('isPopular()', () => {
    it('should return true when job count is above 100', () => {
      const popularTech = new Technology(
        1,
        'React',
        'Frontend',
        'React.js',
        150
      )

      expect(popularTech.isPopular()).toBe(true)
    })

    it('should return true for exactly 101 jobs', () => {
      const tech = new Technology(
        2,
        'Vue',
        'Frontend',
        'Vue.js',
        101
      )

      expect(tech.isPopular()).toBe(true)
    })

    it('should return false when job count is exactly 100', () => {
      const tech = new Technology(
        3,
        'Angular',
        'Frontend',
        'Angular',
        100
      )

      expect(tech.isPopular()).toBe(false)
    })

    it('should return false when job count is below 100', () => {
      const unpopularTech = new Technology(
        4,
        'Svelte',
        'Frontend',
        'Svelte',
        50
      )

      expect(unpopularTech.isPopular()).toBe(false)
    })

    it('should return false when job count is 0', () => {
      const newTech = new Technology(
        5,
        'Qwik',
        'Frontend',
        'Qwik',
        0
      )

      expect(newTech.isPopular()).toBe(false)
    })
  })
})