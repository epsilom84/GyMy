// ══════════════════════════════════════════════
// CONFIG.JS — Constantes globales de la app
// ══════════════════════════════════════════════

const TIPO_ICON={Fuerza:'💪',Cardio:'🏃',HIIT:'🔥',Yoga:'🧘',Pecho:'🏋️',Espalda:'🦾',Piernas:'🦵',Hombros:'🔝',Brazos:'💪',Otro:'⚡'};

// Emojis por equipamiento
const EQUIPO_EM={
  'mancuernas':'💪','mancuerna':'💪',
  'barra':'🏋️',
  'máquina':'🤖','maquina':'🤖',
  'cable':'🔗',
  'peso_corporal':'🧍',
  'cardio':'🏃',
};

// Paths SVG inline por equipamiento (viewBox 0 0 24 24, fill/stroke=currentColor)
const EQUIPO_SVG={
  'mancuernas':`<rect x="0.5" y="8.5" width="3.5" height="7" rx="1.8"/>
    <rect x="4" y="10" width="2" height="4" rx=".8"/>
    <rect x="6" y="11" width="12" height="2" rx="1"/>
    <rect x="18" y="10" width="2" height="4" rx=".8"/>
    <rect x="20" y="8.5" width="3.5" height="7" rx="1.8"/>`,
  'barra':`<rect x="0" y="6.5" width="4" height="11" rx="2"/>
    <rect x="4" y="9.5" width="2.5" height="5" rx=".8"/>
    <rect x="6.5" y="11" width="11" height="2" rx="1"/>
    <rect x="17.5" y="9.5" width="2.5" height="5" rx=".8"/>
    <rect x="20" y="6.5" width="4" height="11" rx="2"/>`,
  'máquina':`<rect x="2.5" y="1" width="3" height="22" rx="1.5"/>
    <rect x="5.5" y="3" width="11" height="2.5" rx="1.2"/>
    <circle cx="16.5" cy="4.25" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="16.5" cy="4.25" r="1"/>
    <rect x="6" y="8" width="5" height="1.8" rx=".5" opacity=".8"/>
    <rect x="6" y="10.6" width="5" height="1.8" rx=".5" opacity=".8"/>
    <rect x="6" y="13.2" width="5" height="1.8" rx=".5" opacity=".8"/>
    <rect x="6" y="15.8" width="5" height="1.8" rx=".5" opacity=".8"/>
    <rect x="6" y="18.4" width="5" height="1.8" rx=".5" opacity=".8"/>
    <line x1="16.5" y1="7.25" x2="14.5" y2="13" stroke="currentColor" stroke-width="1.2"/>
    <rect x="11.5" y="13" width="6" height="2" rx="1"/>`,
  'cable':`<circle cx="12" cy="1.8" r="1.5"/>
    <line x1="12" y1="3.3" x2="12" y2="7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="12" cy="10.5" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="12" cy="10.5" r="1.4"/>
    <line x1="12" y1="14.5" x2="12" y2="18.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M8.5,22.5 L8.5,19.5 Q12,16.8 15.5,19.5 L15.5,22.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="8.5" y1="22.5" x2="15.5" y2="22.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  'peso_corporal':`<circle cx="12" cy="3.5" r="2.5"/>
    <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="12" y1="9" x2="7" y2="13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="12" y1="9" x2="17" y2="13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="12" y1="14" x2="8.5" y2="21" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="12" y1="14" x2="15.5" y2="21" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  'cardio':`<circle cx="15" cy="3.5" r="2.5"/>
    <line x1="14" y1="6" x2="11" y2="14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="13" y1="8.5" x2="18.5" y2="10.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="13" y1="9" x2="8.5" y2="7.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="11" y1="14" x2="16.5" y2="18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="16.5" y1="18" x2="19" y2="22" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="11" y1="14" x2="8" y2="19" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
    <line x1="8" y1="19" x2="5.5" y2="22" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
};

// Colores anatómicos por grupo muscular
const GRUPO_COLORS={
  'Pecho':'#ef5350','Espalda':'#42a5f5','Piernas':'#66bb6a',
  'Hombros':'#ab47bc','Brazos':'#ffa726','Core':'#26c6da','Cardio':'#ec407a',
};

// Emojis por grupo para el selector
const GRUPO_EM={
  'Pecho':'🏋️','Espalda':'🦾','Piernas':'🦵','Hombros':'🔝',
  'Brazos':'💪','Core':'🧘','Cardio':'🏃',
};

// Iconos personalizados por ejercicio
const EJ_ICONOS={
  'sentadilla barra':'/assets/descarga.jpeg',
  'sentadilla con barra':'/assets/iconos_tipos_ejercicios/Sentadilla%20con%20barra.gif',
  'aperturas en m\u00e1quina sentado':'/assets/iconos_tipos_ejercicios/Aperturas%20en%20m%C3%A1quina%20sentado.jpeg',
  'curl alterno con mancuernas sentado':'/assets/iconos_tipos_ejercicios/Curl%20alterno%20con%20mancuernas%20sentado.png',
  'curl alterno de b\u00edceps con mancuernas de pie':'/assets/iconos_tipos_ejercicios/Curl%20alterno%20de%20b%C3%ADceps%20con%20mancuernas%20de%20pie.gif',
  'curl de piernas sentado femoral':'/assets/iconos_tipos_ejercicios/Curl%20de%20piernas%20sentado%20femoral.jpg',
  'curl predicador con mancuerna':'/assets/iconos_tipos_ejercicios/Curl%20predicador%20con%20mancuerna%20%28scott%29.jpg',
  'elevaciones laterales con mancuernas de pie':'/assets/iconos_tipos_ejercicios/Elevaciones%20laterales%20con%20mancuernas%20de%20pie.jpg',
  'elevaci\u00f3n de talones con barra sentado':'/assets/iconos_tipos_ejercicios/Elevaci%C3%B3n%20de%20talones%20con%20barra%20sentado.jpg',
  'elevaci\u00f3n lateral en polea una mano':'/assets/iconos_tipos_ejercicios/Elevaci%C3%B3n%20lateral%20en%20polea%20una%20mano.jpg',
  'extensiones de tr\u00edceps con cuerda':'/assets/iconos_tipos_ejercicios/Extensiones%20de%20tr%C3%ADceps%20con%20cuerda.jpeg',
  'extensi\u00f3n de cu\u00e1driceps':'/assets/iconos_tipos_ejercicios/Extensi%C3%B3n%20de%20cu%C3%A1driceps%20Leg%20extension.jpg',
  'face pull':'/assets/iconos_tipos_ejercicios/Face%20pull.jpeg',
  'jal\u00f3n al pecho agarre ancho':'/assets/iconos_tipos_ejercicios/Jal%C3%B3n%20al%20pecho%20agarre%20ancho.jpeg',
  'jal\u00f3n al pecho agarre neutro cerrado':'/assets/iconos_tipos_ejercicios/Jal%C3%B3n%20al%20pecho%20agarre%20neutro%20cerrado.gif',
  'levantamiento lateral m\u00e1quina':'/assets/iconos_tipos_ejercicios/Levantamiento%20lateral%20m%C3%A1quina.jpeg',
  'm\u00e1quina de abductores sentado':'/assets/iconos_tipos_ejercicios/M%C3%A1quina%20de%20abductores%20sentado.jpg',
  'm\u00e1quina de aductores sentado':'/assets/iconos_tipos_ejercicios/M%C3%A1quina%20de%20aductores%20sentado.gif',
  'peso muerto con barra':'/assets/iconos_tipos_ejercicios/Peso%20muerto%20con%20barra.jpeg',
  'prensa de piernas inclinado':'/assets/iconos_tipos_ejercicios/Prensa%20de%20piernas%20inclinado.jpeg',
  'press de hombros con mancuernas sentado':'/assets/iconos_tipos_ejercicios/Press%20de%20hombros%20con%20mancuernas%20sentado.jpg',
  'press de hombros en m\u00e1quina sentado':'/assets/iconos_tipos_ejercicios/Press%20de%20hombros%20en%20m%C3%A1quina%20sentado.gif',
  'press de pecho en m\u00e1quina':'/assets/iconos_tipos_ejercicios/Press%20de%20pecho%20en%20m%C3%A1quina%20inclinado.jpg',
  'press de pecho sentado en m\u00e1quina':'/assets/iconos_tipos_ejercicios/Press%20de%20pecho%20sentado%20en%20m%C3%A1quina.jpeg',
  'press militar con barra de pie':'/assets/iconos_tipos_ejercicios/Press%20militar%20con%20barra%20de%20pie.jpg',
  'press piernas horizontal':'/assets/iconos_tipos_ejercicios/Press%20piernas%20horizontal.webp',
  'pull down m\u00e1quina':'/assets/iconos_tipos_ejercicios/Pull%20down%20m%C3%A1quina.jpeg',
  'remo con barra supino yates row':'/assets/iconos_tipos_ejercicios/Remo%20con%20barra%20supino%20Yates%20Row.jpg',
  'remo en polea baja sentado':'/assets/iconos_tipos_ejercicios/Remo%20en%20polea%20baja%20sentado.jpg',
  'remo polea unilateral':'/assets/iconos_tipos_ejercicios/Remo%20polea%20unilateral.jpg',
  'remo m\u00e1quina unilateral':'/assets/iconos_tipos_ejercicios/remo%20m%C3%A1quina%20unilateral.webp',
  'remo 2 unilateral maquina':'/assets/iconos_tipos_ejercicios/remo%202%20unilateral%20maquina.jpeg',
};

// Mapping tipo de sesión → grupo SVG para icono
const TIPO_GRUPO_SVG={Fuerza:'Pecho',Cardio:'Piernas (Gemelos)',HIIT:'Core',Yoga:'Core',Pecho:'Pecho',Espalda:'Espalda (Dorsal)',Piernas:'Piernas (Cuádriceps)',Hombros:'Hombros',Brazos:'Brazos Bíceps',Core:'Core'};
