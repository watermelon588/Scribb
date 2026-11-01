export type PresetId = 'linen' | 'archive' | 'softcover'
export type TurnStyle = 'curl' | 'hinge' | 'float'
export type Format = '3:4' | '1:1' | '4:3' | '16:9'

export interface Artwork {
  id: string
  src: string
  title: string
  artist: string
  medium: string
  source?: string
}

export interface BookPreset {
  id: PresetId
  number: string
  name: string
  description: string
  material: string
  font: string
  turnStyle: TurnStyle
  format: Format
  color: string
  colors: { name: string; value: string }[]
  title: string
  subtitle: string
}

export const presets: BookPreset[] = [
  {
    id: 'linen', number: '01', name: 'The Linen',
    description: 'A quiet classic, with a tactile soul.', material: 'Woven cloth',
    font: 'Manrope', turnStyle: 'curl', format: '3:4', color: '#526756',
    colors: [
      { name: 'Moss', value: '#526756' }, { name: 'French blue', value: '#62778b' },
      { name: 'Terracotta', value: '#a56855' }, { name: 'Oat', value: '#b6a88b' },
      { name: 'Charcoal', value: '#454744' },
    ],
    title: 'In good nature', subtitle: 'A collection of small observations',
  },
  {
    id: 'archive', number: '02', name: 'The Archive',
    description: 'For the things worth keeping.', material: 'Fine-grain leather',
    font: 'Newsreader', turnStyle: 'hinge', format: '3:4', color: '#76504c',
    colors: [
      { name: 'Oxblood', value: '#76504c' }, { name: 'Midnight', value: '#3b465a' },
      { name: 'Pine', value: '#3e544d' }, { name: 'Saddle', value: '#967052' },
      { name: 'Ink', value: '#373a3d' },
    ],
    title: 'Collected moments', subtitle: 'An archive of looking closely',
  },
  {
    id: 'softcover', number: '03', name: 'The Softcover',
    description: 'A little lighter. A little freer.', material: 'Uncoated stock',
    font: 'DM Sans', turnStyle: 'float', format: '4:3', color: '#b8c1d5',
    colors: [
      { name: 'Periwinkle', value: '#b8c1d5' }, { name: 'Butter', value: '#d8ca95' },
      { name: 'Dusty rose', value: '#c9a7a4' }, { name: 'Celadon', value: '#a7b9aa' },
      { name: 'Stone', value: '#bcbcb5' },
    ],
    title: 'Notes on seeing', subtitle: 'An ongoing practice',
  },
]

export const formats: { id: Format; ratio: number; label: string }[] = [
  { id: '3:4', ratio: 3 / 4, label: 'Portrait' },
  { id: '1:1', ratio: 1, label: 'Square' },
  { id: '4:3', ratio: 4 / 3, label: 'Landscape' },
  { id: '16:9', ratio: 16 / 9, label: 'Wide' },
]

export const turnStyles: { id: TurnStyle; name: string; description: string }[] = [
  { id: 'curl', name: 'Curl', description: 'A soft, flowing paper turn' },
  { id: 'hinge', name: 'Hinge', description: 'A sculptural, bound-page turn' },
  { id: 'float', name: 'Float', description: 'A light turn with a gentle lift' },
]

export const sampleArtworks: Artwork[] = [
  { id: 'roses', src: '/artworks/roses.jpg', title: 'Roses', artist: 'Vincent van Gogh', medium: 'Oil on canvas · 1890', source: 'https://www.metmuseum.org/art/collection/search/436534' },
  { id: 'irises', src: '/artworks/irises.jpg', title: 'Irises', artist: 'Vincent van Gogh', medium: 'Oil on canvas · 1890', source: 'https://www.metmuseum.org/art/collection/search/436528' },
  { id: 'cypresses', src: '/artworks/cypresses.jpg', title: 'Wheat Field with Cypresses', artist: 'Vincent van Gogh', medium: 'Oil on canvas · 1889', source: 'https://www.metmuseum.org/art/collection/search/436535' },
  { id: 'oleanders', src: '/artworks/oleanders.jpg', title: 'Oleanders', artist: 'Vincent van Gogh', medium: 'Oil on canvas · 1888', source: 'https://www.metmuseum.org/art/collection/search/436530' },
  { id: 'olives', src: '/artworks/olives.jpg', title: 'Women Picking Olives', artist: 'Vincent van Gogh', medium: 'Oil on canvas · 1889', source: 'https://www.metmuseum.org/art/collection/search/436536' },
  { id: 'venice', src: '/artworks/venice.jpg', title: 'Venice, from the Porch of Madonna della Salute', artist: 'Joseph Mallord William Turner', medium: 'Oil on canvas · ca. 1835', source: 'https://www.metmuseum.org/art/collection/search/437853' },
]
