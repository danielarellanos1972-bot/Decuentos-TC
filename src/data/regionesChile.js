// Regiones de Chile (las 16), con Región Metropolitana como default de la app.
export const REGIONES_CHILE = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana de Santiago',
  "Libertador General Bernardo O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén del General Carlos Ibáñez del Campo',
  'Magallanes y de la Antártica Chilena',
];

export const REGION_DEFAULT = 'Metropolitana de Santiago';

// Comunas de la Región Metropolitana (la región por defecto), para un selector preciso.
// Para el resto de las regiones se usa un campo de texto libre en vez de esta lista,
// ya que mantener el listado completo de comunas de las 16 regiones sería excesivo
// para el alcance de esta app.
export const COMUNAS_RM = [
  'Santiago', 'Providencia', 'Las Condes', 'Vitacura', 'Lo Barnechea', 'La Reina',
  'Ñuñoa', 'Macul', 'Peñalolén', 'La Florida', 'Puente Alto', 'San Miguel',
  'La Cisterna', 'San Joaquín', 'Pedro Aguirre Cerda', 'Estación Central',
  'Quinta Normal', 'Independencia', 'Recoleta', 'Conchalí', 'Huechuraba',
  'Quilicura', 'Renca', 'Cerro Navia', 'Lo Prado', 'Pudahuel', 'Maipú',
  'Cerrillos', 'San Bernardo', 'La Granja', 'La Pintana', 'El Bosque',
  'San Ramón', 'Lo Espejo', 'Colina', 'Lampa', 'Til Til', 'Chicureo (Colina)',
  'Melipilla', 'Talagante', 'Peñaflor', 'Buin', 'Paine',
];
