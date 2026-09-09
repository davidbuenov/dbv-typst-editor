// =============================================================================
// DBV Typst Editor — Miniaturas vectoriales para la galería de plantillas
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-20: Generación de miniaturas vectoriales (SVG) de alta resolución y bajo peso
// para previsualizar visualmente la maquetación de cada plantilla en el lanzador
// y en el modal de detalle de plantilla.

/**
 * Devuelve el marcado SVG de la miniatura representativa para una plantilla.
 * @param {string} templateId Identificador de la plantilla (ej: "@local/dbv-tfg")
 * @returns {string} Código SVG vectorial
 */
/**
 * Normaliza el identificador de una plantilla para búsqueda y renderizado de SVG.
 * Soporta @local/id, @preview/name:version, name:version, o name simple.
 * @param {string} templateId
 * @returns {string} Identificador canónico en minúsculas
 */
export function normalizeTemplateId(templateId) {
  if (!templateId) return '';
  return templateId
    .trim()
    .replace(/^(@local\/|@preview\/)/, '')
    .split(':')[0]
    .toLowerCase();
}

/**
 * Devuelve el marcado SVG de la miniatura representativa para una plantilla.
 * @param {string} templateId Identificador de la plantilla (ej: "@local/dbv-tfg", "@preview/charged-ieee:0.1.4")
 * @returns {string} Código SVG vectorial
 */
export function getTemplateThumbnailSvg(templateId) {
  const id = normalizeTemplateId(templateId);

  switch (id) {
    case 'charged-ieee':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <rect x="25" y="20" width="160" height="4" rx="1" fill="var(--text-muted)"/>
          <rect x="35" y="32" width="140" height="8" rx="2" fill="var(--text-primary)"/>
          <rect x="60" y="44" width="90" height="4" rx="1" fill="var(--accent)"/>
          <rect x="25" y="55" width="160" height="18" rx="2" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <!-- 2 columnas IEEE -->
          <rect x="25" y="80" width="75" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="25" y="88" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="93" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="102" width="75" height="40" rx="2" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <path d="M30 132 L50 115 L70 125 L95 110" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <rect x="110" y="80" width="75" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="110" y="88" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="110" y="93" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="110" y="102" width="75" height="35" rx="2" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <line x1="110" y1="114" x2="185" y2="114" stroke="var(--border)" stroke-width="1"/>
          <rect x="110" y="145" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="110" y="150" width="60" height="2.5" rx="1" fill="var(--text-muted)"/>
          <!-- Pie -->
          <rect x="25" y="275" width="60" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="175" y="275" width="10" height="3" rx="1" fill="var(--text-muted)"/>
        </svg>
      `;

    case 'faithful-acmart':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <rect x="25" y="18" width="50" height="6" rx="1" fill="var(--accent)"/>
          <rect x="145" y="18" width="40" height="4" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="32" width="160" height="8" rx="2" fill="var(--text-primary)"/>
          <rect x="25" y="44" width="120" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="25" y="55" width="160" height="20" rx="2" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <!-- 2 columnas ACM -->
          <rect x="25" y="82" width="75" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="25" y="90" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="95" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="105" width="75" height="25" rx="2" fill="var(--bg-tertiary)"/>
          <rect x="110" y="82" width="75" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="110" y="90" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="110" y="95" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="110" y="105" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="110" y="115" width="75" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="110" y="123" width="75" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="275" width="70" height="3" rx="1" fill="var(--text-muted)"/>
        </svg>
      `;

    case 'springer-spaniel':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <rect x="35" y="22" width="60" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="140" y="22" width="35" height="3" rx="1" fill="var(--text-muted)"/>
          <line x1="35" y1="28" x2="175" y2="28" stroke="var(--border)" stroke-width="1"/>
          <!-- Titulo Springer centrado -->
          <rect x="55" y="45" width="100" height="7" rx="2" fill="var(--text-primary)"/>
          <rect x="70" y="56" width="70" height="6" rx="2" fill="var(--text-primary)"/>
          <rect x="75" y="68" width="60" height="4" rx="1" fill="var(--accent)"/>
          <!-- Abstract indentado clasico -->
          <rect x="50" y="82" width="110" height="28" rx="2" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <!-- 1 columna ancha Springer -->
          <rect x="35" y="120" width="60" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="35" y="128" width="140" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="35" y="133" width="140" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="35" y="138" width="125" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="35" y="148" width="140" height="35" rx="2" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <rect x="35" y="275" width="50" height="3" rx="1" fill="var(--text-muted)"/>
        </svg>
      `;

    case 'ilm':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Bloque acento superior ilm -->
          <rect x="0" y="0" width="210" height="12" fill="var(--accent)"/>
          <rect x="30" y="35" width="120" height="10" rx="2" fill="var(--text-primary)"/>
          <rect x="30" y="50" width="80" height="6" rx="1.5" fill="var(--text-secondary)"/>
          <rect x="30" y="62" width="60" height="4" rx="1" fill="var(--text-muted)"/>
          <line x1="30" y1="75" x2="180" y2="75" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Indice / TOC estilizado -->
          <rect x="30" y="90" width="150" height="50" rx="3" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <!-- Callout con barra lateral azul -->
          <rect x="30" y="152" width="4" height="36" rx="2" fill="var(--accent)"/>
          <rect x="40" y="155" width="135" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="40" y="162" width="140" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="40" y="169" width="110" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="30" y="270" width="60" height="3" rx="1" fill="var(--text-muted)"/>
        </svg>
      `;

    case 'modern-cv':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Cabecera centrada Awesome-CV -->
          <rect x="45" y="22" width="120" height="9" rx="2" fill="var(--text-primary)"/>
          <rect x="65" y="35" width="80" height="5" rx="1.5" fill="#dc2626"/>
          <rect x="40" y="44" width="130" height="3" rx="1" fill="var(--text-muted)"/>
          <!-- Seccion con acento rojo -->
          <rect x="25" y="58" width="14" height="4" rx="1" fill="#dc2626"/>
          <rect x="42" y="58" width="40" height="4" rx="1" fill="var(--text-primary)"/>
          <line x1="25" y1="66" x2="185" y2="66" stroke="var(--border)" stroke-width="1"/>
          <!-- Entradas de experiencia -->
          <rect x="25" y="74" width="65" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="150" y="74" width="35" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="81" width="150" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="86" width="140" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="98" width="60" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="150" y="98" width="35" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="105" width="145" height="2.5" rx="1" fill="var(--text-muted)"/>
          <!-- Seccion 2 -->
          <rect x="25" y="120" width="14" height="4" rx="1" fill="#dc2626"/>
          <rect x="42" y="120" width="35" height="4" rx="1" fill="var(--text-primary)"/>
          <line x1="25" y1="128" x2="185" y2="128" stroke="var(--border)" stroke-width="1"/>
          <rect x="25" y="136" width="70" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="25" y="143" width="130" height="2.5" rx="1" fill="var(--text-muted)"/>
        </svg>
      `;

    case 'appreciated-letter':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Remitente arriba derecha -->
          <rect x="125" y="25" width="55" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="135" y="32" width="45" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="140" y="38" width="40" height="3" rx="1" fill="var(--text-muted)"/>
          <!-- Destinatario arriba izquierda -->
          <rect x="30" y="55" width="60" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="30" y="62" width="50" height="3" rx="1" fill="var(--text-muted)"/>
          <!-- Asunto -->
          <rect x="30" y="78" width="150" height="12" rx="2" fill="var(--bg-secondary)"/>
          <rect x="35" y="82" width="80" height="4" rx="1" fill="var(--text-secondary)"/>
          <!-- Parrafos de la carta -->
          <rect x="30" y="102" width="40" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="30" y="112" width="150" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="30" y="118" width="150" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="30" y="124" width="130" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="30" y="136" width="150" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="30" y="142" width="140" height="3" rx="1" fill="var(--text-muted)"/>
          <!-- Firma -->
          <path d="M30 180 Q 45 165, 60 185 T 90 170" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
          <rect x="30" y="192" width="55" height="4" rx="1" fill="var(--text-secondary)"/>
        </svg>
      `;

    case 'dbv-tfg':
    case 'dbv-tfm':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Franja institucional superior -->
          <rect x="25" y="25" width="160" height="4" rx="2" fill="var(--accent)"/>
          <circle cx="105" cy="65" r="18" fill="var(--bg-tertiary)" stroke="var(--border-strong)" stroke-width="1.5"/>
          <path d="M105 54 L114 70 L96 70 Z" fill="var(--accent)" opacity="0.8"/>
          <!-- Titulo del TFG -->
          <rect x="40" y="115" width="130" height="8" rx="2" fill="var(--text-primary)"/>
          <rect x="55" y="128" width="100" height="6" rx="2" fill="var(--text-secondary)"/>
          <!-- Caja de Autor y Tutor -->
          <rect x="35" y="195" width="140" height="55" rx="3" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <rect x="45" y="208" width="60" height="5" rx="1.5" fill="var(--text-secondary)"/>
          <rect x="45" y="218" width="80" height="4" rx="1" fill="var(--text-muted)"/>
          <rect x="45" y="230" width="55" height="5" rx="1.5" fill="var(--text-secondary)"/>
          <rect x="45" y="240" width="70" height="4" rx="1" fill="var(--text-muted)"/>
          <!-- Pie -->
          <rect x="80" y="270" width="50" height="4" rx="1" fill="var(--text-muted)"/>
        </svg>
      `;

    case 'dbv-articulo':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Titulo y autores -->
          <rect x="25" y="25" width="160" height="9" rx="2" fill="var(--text-primary)"/>
          <rect x="45" y="38" width="120" height="5" rx="1.5" fill="var(--accent)"/>
          <rect x="60" y="47" width="90" height="4" rx="1" fill="var(--text-muted)"/>
          <!-- Resumen / Abstract -->
          <rect x="30" y="60" width="150" height="25" rx="2" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <rect x="36" y="66" width="30" height="3.5" rx="1" fill="var(--text-secondary)"/>
          <rect x="36" y="73" width="138" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="36" y="78" width="125" height="2.5" rx="1" fill="var(--text-muted)"/>
          <!-- Dos columnas -->
          <!-- Columna izquierda -->
          <rect x="25" y="95" width="74" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="25" y="103" width="74" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="108" width="74" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="113" width="60" height="2.5" rx="1" fill="var(--text-muted)"/>
          <!-- Grafica columna izq -->
          <rect x="25" y="125" width="74" height="45" rx="2" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <path d="M30 160 Q 45 135, 60 145 T 90 135" fill="none" stroke="var(--accent)" stroke-width="2"/>
          <rect x="35" y="174" width="54" height="2.5" rx="1" fill="var(--text-muted)"/>
          <!-- Columna derecha -->
          <rect x="111" y="95" width="74" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="111" y="103" width="74" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="111" y="108" width="74" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="111" y="113" width="74" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="111" y="118" width="55" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="111" y="130" width="74" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="111" y="138" width="74" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="111" y="143" width="74" height="2.5" rx="1" fill="var(--text-muted)"/>
          <rect x="111" y="148" width="74" height="2.5" rx="1" fill="var(--text-muted)"/>
        </svg>
      `;

    case 'dbv-tesis':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Borde interior fino solemne -->
          <rect x="18" y="18" width="174" height="261" rx="2" fill="none" stroke="var(--border)" stroke-width="1"/>
          <!-- Escudo / Institucion -->
          <circle cx="105" cy="55" r="16" fill="var(--bg-secondary)" stroke="var(--accent)" stroke-width="1.5"/>
          <rect x="50" y="80" width="110" height="4" rx="1" fill="var(--text-muted)"/>
          <!-- Titulo solemne -->
          <rect x="35" y="115" width="140" height="9" rx="2" fill="var(--text-primary)"/>
          <rect x="45" y="128" width="120" height="8" rx="2" fill="var(--text-primary)"/>
          <rect x="70" y="145" width="70" height="4" rx="1" fill="var(--accent)"/>
          <!-- Programa de doctorado -->
          <rect x="60" y="170" width="90" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="75" y="177" width="60" height="3" rx="1" fill="var(--text-muted)"/>
          <!-- Autor y fecha -->
          <rect x="70" y="235" width="70" height="6" rx="2" fill="var(--text-secondary)"/>
          <rect x="85" y="248" width="40" height="4" rx="1" fill="var(--text-muted)"/>
        </svg>
      `;

    case 'dbv-informe-tecnico':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Encabezado con banda de acento -->
          <rect x="25" y="25" width="6" height="32" rx="2" fill="var(--accent)"/>
          <rect x="38" y="27" width="100" height="9" rx="2" fill="var(--text-primary)"/>
          <rect x="38" y="40" width="70" height="5" rx="1.5" fill="var(--text-secondary)"/>
          <rect x="38" y="48" width="50" height="4" rx="1" fill="var(--text-muted)"/>
          <!-- Tarjeta de metadatos (Fecha, Estado, Version) -->
          <rect x="25" y="70" width="160" height="26" rx="3" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <circle cx="40" cy="83" r="5" fill="var(--accent)"/>
          <rect x="52" y="79" width="40" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="52" y="85" width="25" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="115" y="79" width="45" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="115" y="85" width="30" height="3" rx="1" fill="var(--text-muted)"/>
          <!-- Resumen ejecutivo -->
          <rect x="25" y="110" width="80" height="6" rx="1.5" fill="var(--text-primary)"/>
          <rect x="25" y="122" width="160" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="128" width="160" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="25" y="134" width="120" height="3" rx="1" fill="var(--text-muted)"/>
          <!-- Tabla tecnica -->
          <rect x="25" y="150" width="160" height="50" rx="3" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1"/>
          <rect x="25" y="150" width="160" height="12" rx="3" fill="var(--bg-tertiary)"/>
          <line x1="25" y1="174" x2="185" y2="174" stroke="var(--border)" stroke-width="1"/>
          <line x1="25" y1="187" x2="185" y2="187" stroke="var(--border)" stroke-width="1"/>
        </svg>
      `;

    case 'dbv-presentacion':
      return `
        <svg viewBox="0 0 320 180" class="template-thumbnail-svg template-thumbnail-svg--slide" xmlns="http://www.w3.org/2000/svg">
          <rect width="320" height="180" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Acento decorativo 16:9 -->
          <circle cx="280" cy="30" r="45" fill="var(--accent)" opacity="0.12"/>
          <!-- Diapositiva de titulo -->
          <rect x="35" y="45" width="220" height="16" rx="3" fill="var(--text-primary)"/>
          <rect x="35" y="68" width="160" height="12" rx="2" fill="var(--text-secondary)"/>
          <line x1="35" y1="92" x2="120" y2="92" stroke="var(--accent)" stroke-width="3"/>
          <rect x="35" y="110" width="130" height="7" rx="2" fill="var(--text-muted)"/>
          <rect x="35" y="122" width="90" height="6" rx="1.5" fill="var(--text-muted)"/>
          <!-- Barra inferior -->
          <rect x="0" y="172" width="320" height="8" fill="var(--accent)"/>
        </svg>
      `;

    case 'dbv-cv':
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Barra lateral izquierda -->
          <rect x="0" y="0" width="65" height="297" fill="var(--bg-secondary)"/>
          <line x1="65" y1="0" x2="65" y2="297" stroke="var(--border)" stroke-width="1"/>
          <!-- Avatar -->
          <circle cx="32.5" cy="40" r="18" fill="var(--bg-tertiary)" stroke="var(--accent)" stroke-width="2"/>
          <!-- Datos de contacto -->
          <rect x="12" y="72" width="41" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="12" y="80" width="41" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="12" y="86" width="35" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="12" y="92" width="38" height="3" rx="1" fill="var(--text-muted)"/>
          <!-- Habilidades / Skills -->
          <rect x="12" y="115" width="41" height="4" rx="1" fill="var(--text-primary)"/>
          <rect x="12" y="124" width="32" height="4" rx="2" fill="var(--accent)" opacity="0.7"/>
          <rect x="12" y="132" width="40" height="4" rx="2" fill="var(--accent)" opacity="0.7"/>
          <rect x="12" y="140" width="28" height="4" rx="2" fill="var(--accent)" opacity="0.7"/>
          <!-- Columna principal derecha -->
          <rect x="80" y="28" width="105" height="10" rx="2" fill="var(--text-primary)"/>
          <rect x="80" y="42" width="70" height="5" rx="1.5" fill="var(--accent)"/>
          <!-- Experiencia -->
          <rect x="80" y="65" width="80" height="6" rx="1.5" fill="var(--text-primary)"/>
          <line x1="80" y1="74" x2="195" y2="74" stroke="var(--border)" stroke-width="1"/>
          <rect x="80" y="80" width="60" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="80" y="87" width="115" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="80" y="93" width="110" height="3" rx="1" fill="var(--text-muted)"/>
          <!-- Educacion -->
          <rect x="80" y="115" width="80" height="6" rx="1.5" fill="var(--text-primary)"/>
          <line x1="80" y1="124" x2="195" y2="124" stroke="var(--border)" stroke-width="1"/>
          <rect x="80" y="130" width="65" height="4" rx="1" fill="var(--text-secondary)"/>
          <rect x="80" y="137" width="100" height="3" rx="1" fill="var(--text-muted)"/>
        </svg>
      `;

    case 'dbv-blank':
    default:
      return `
        <svg viewBox="0 0 210 297" class="template-thumbnail-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="210" height="297" rx="4" fill="var(--bg-primary)" stroke="var(--border)" stroke-width="1.5"/>
          <!-- Icono de documento limpio minimalista -->
          <rect x="35" y="35" width="70" height="7" rx="2" fill="var(--accent)"/>
          <rect x="35" y="52" width="140" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="35" y="60" width="140" height="3" rx="1" fill="var(--text-muted)"/>
          <rect x="35" y="68" width="90" height="3" rx="1" fill="var(--text-muted)"/>
          <circle cx="105" cy="160" r="28" fill="var(--bg-secondary)" stroke="var(--border)" stroke-width="1.5"/>
          <path d="M96 160 L114 160 M105 151 L105 169" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      `;
  }
}

/**
 * Devuelve el SVG de alta fidelidad que simula una página completa renderizada
 * para la vista previa detallada en el modal de catálogo de plantillas.
 * @param {string} templateId Identificador de la plantilla
 * @returns {string} Código SVG vectorial de alta fidelidad
 */
export function getTemplateFullPreviewSvg(templateId) {
  const id = normalizeTemplateId(templateId);

  switch (id) {
    case 'charged-ieee':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Cabecera oficial IEEE -->
          <text x="50" y="42" font-family="'Times New Roman', serif" font-size="9" font-style="italic" fill="#475569">IEEE TRANSACTIONS ON COMPUTATIONAL SCIENCE, VOL. 32, NO. 4, APRIL 2026</text>
          <line x1="50" y1="48" x2="545" y2="48" stroke="#cbd5e1" stroke-width="0.8"/>

          <!-- Titulo del Articulo IEEE -->
          <text x="297" y="80" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill="#0f172a">Adaptive Incremental Rendering for Reactive Scientific Composition</text>

          <!-- Autores en bloque de columnas IEEE -->
          <g transform="translate(70, 105)">
            <text x="65" y="0" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0284c7">David Bueno Vallejo*</text>
            <text x="65" y="14" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#64748b">University of Málaga</text>
            <text x="65" y="26" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#64748b">Málaga, Spain</text>
            <text x="65" y="38" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#0284c7">bueno@uma.es</text>

            <text x="225" y="0" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0284c7">Elena Morales Sanz†</text>
            <text x="225" y="14" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#64748b">CSIC-UPC Barcelona</text>
            <text x="225" y="26" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#64748b">Barcelona, Spain</text>
            <text x="225" y="38" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#0284c7">elena.morales@csic.es</text>

            <text x="385" y="0" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0284c7">Marcus Vance‡</text>
            <text x="385" y="14" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#64748b">IEEE Computer Society</text>
            <text x="385" y="26" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#64748b">Los Alamitos, USA</text>
            <text x="385" y="38" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#0284c7">m.vance@ieee.org</text>
          </g>

          <!-- Abstract e Index Terms -->
          <g transform="translate(60, 165)">
            <rect x="0" y="0" width="475" height="58" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            <text x="14" y="16" font-family="'Times New Roman', serif" font-size="10" font-weight="700" fill="#0f172a">Abstract—</text>
            <text x="68" y="16" font-family="'Times New Roman', serif" font-size="9.5" fill="#334155">This paper introduces an incremental evaluation architecture for Typst documents,</text>
            <text x="14" y="30" font-family="'Times New Roman', serif" font-size="9.5" fill="#334155">achieving sub-16 millisecond interactive updates on 200+ page scientific monographs.</text>
            <text x="14" y="48" font-family="'Times New Roman', serif" font-size="9" font-weight="700" fill="#0284c7">Index Terms—Typst, reactive compilation, LSP, scientific publishing, document synthesis.</text>
          </g>

          <!-- Maqueta IEEE 2 Columnas -->
          <!-- Columna 1 -->
          <g transform="translate(50, 240)">
            <text x="115" y="12" text-anchor="middle" font-family="'Times New Roman', serif" font-size="11" font-weight="700" fill="#0f172a" letter-spacing="1">I. INTRODUCTION</text>
            
            <!-- Capitular T -->
            <rect x="0" y="22" width="22" height="24" rx="2" fill="#0284c7"/>
            <text x="11" y="41" text-anchor="middle" font-family="'Times New Roman', serif" font-size="20" font-weight="700" fill="#ffffff">T</text>
            <text x="26" y="32" font-family="'Times New Roman', serif" font-size="9.5" fill="#334155">YPESETTING scientific manuscripts with real-time</text>
            <text x="26" y="44" font-family="'Times New Roman', serif" font-size="9.5" fill="#334155">feedback has historically been constrained by</text>
            <text x="0" y="58" font-family="'Times New Roman', serif" font-size="9.5" fill="#334155">monolithic document compilation pipelines.</text>

            <rect x="0" y="68" width="230" height="4.5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="76" width="230" height="4.5" rx="2" fill="#e2e8f0"/>
            <rect x="0" y="84" width="190" height="4.5" rx="2" fill="#e2e8f0"/>

            <!-- Formula matematica IEEE -->
            <rect x="0" y="98" width="230" height="38" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            <text x="100" y="122" text-anchor="middle" font-family="'Times New Roman', serif" font-size="13" font-style="italic" fill="#0f172a">L_render(τ) = ∑ ω_k · Δt_k + O(1)</text>
            <text x="215" y="122" text-anchor="end" font-family="'Times New Roman', serif" font-size="10" fill="#64748b">(1)</text>

            <!-- Diagrama IEEE Fig 1 -->
            <rect x="0" y="148" width="230" height="110" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
            <!-- Bloques del diagrama -->
            <rect x="15" y="165" width="55" height="28" rx="4" fill="#eff6ff" stroke="#0284c7" stroke-width="1"/>
            <text x="42" y="182" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="8" font-weight="700" fill="#0284c7">AST Cache</text>
            <line x1="70" y1="179" x2="85" y2="179" stroke="#0284c7" stroke-width="1.5"/>
            <polygon points="85,176 90,179 85,182" fill="#0284c7"/>

            <rect x="90" y="165" width="55" height="28" rx="4" fill="#ecfdf5" stroke="#059669" stroke-width="1"/>
            <text x="117" y="182" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="8" font-weight="700" fill="#059669">Banded Run</text>
            <line x1="145" y1="179" x2="160" y2="179" stroke="#059669" stroke-width="1.5"/>
            <polygon points="160,176 165,179 160,182" fill="#059669"/>

            <rect x="165" y="165" width="55" height="28" rx="4" fill="#fef3c7" stroke="#d97706" stroke-width="1"/>
            <text x="192" y="182" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="8" font-weight="700" fill="#d97706">Frame SVG</text>

            <text x="115" y="215" text-anchor="middle" font-family="'Times New Roman', serif" font-size="8.5" font-style="italic" fill="#475569">Fig. 1. Pipeline of the reactive compilation engine.</text>

            <rect x="0" y="270" width="230" height="4.5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="278" width="230" height="4.5" rx="2" fill="#e2e8f0"/>
          </g>

          <!-- Columna 2 -->
          <g transform="translate(315, 240)">
            <text x="115" y="12" text-anchor="middle" font-family="'Times New Roman', serif" font-size="11" font-weight="700" fill="#0f172a" letter-spacing="1">II. PERFORMANCE EVALUATION</text>

            <!-- Tabla IEEE -->
            <text x="115" y="32" text-anchor="middle" font-family="'Times New Roman', serif" font-size="9" font-weight="700" fill="#0f172a">TABLE I: LATENCY BENCHMARKS</text>
            <rect x="0" y="40" width="230" height="85" rx="3" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
            <rect x="0" y="40" width="230" height="20" fill="#f8fafc"/>
            <text x="8" y="54" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#334155">Doc Size</text>
            <text x="75" y="54" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#334155">Full Build</text>
            <text x="135" y="54" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#334155">DBV Incr.</text>
            <text x="195" y="54" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#334155">Gain</text>
            <line x1="0" y1="60" x2="230" y2="60" stroke="#cbd5e1" stroke-width="1"/>

            <text x="8" y="75" font-family="'Times New Roman', serif" font-size="8.5" fill="#0f172a">10 pages</text>
            <text x="75" y="75" font-family="'Times New Roman', serif" font-size="8.5" fill="#64748b">180 ms</text>
            <text x="135" y="75" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#16a34a">12 ms</text>
            <text x="195" y="75" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#0284c7">15.0x</text>

            <text x="8" y="95" font-family="'Times New Roman', serif" font-size="8.5" fill="#0f172a">50 pages</text>
            <text x="75" y="95" font-family="'Times New Roman', serif" font-size="8.5" fill="#64748b">620 ms</text>
            <text x="135" y="95" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#16a34a">16 ms</text>
            <text x="195" y="95" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#0284c7">38.7x</text>

            <text x="8" y="115" font-family="'Times New Roman', serif" font-size="8.5" fill="#0f172a">200 pages</text>
            <text x="75" y="115" font-family="'Times New Roman', serif" font-size="8.5" fill="#64748b">2400 ms</text>
            <text x="135" y="115" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#16a34a">22 ms</text>
            <text x="195" y="115" font-family="'Times New Roman', serif" font-size="8.5" font-weight="700" fill="#0284c7">109.1x</text>

            <text x="115" y="145" text-anchor="middle" font-family="'Times New Roman', serif" font-size="11" font-weight="700" fill="#0f172a" letter-spacing="1">III. REFERENCES</text>
            <g transform="translate(0, 155)">
              <text x="0" y="10" font-family="'Times New Roman', serif" font-size="8.5" fill="#334155">[1] D. Bueno Vallejo, "Reactive Document Pipelines," IEEE Trans. Doc. Eng., 2026.</text>
              <text x="0" y="24" font-family="'Times New Roman', serif" font-size="8.5" fill="#334155">[2] L. Haug and M. Mädler, "Typst: A Modern Typesetting System," 2023.</text>
              <text x="0" y="38" font-family="'Times New Roman', serif" font-size="8.5" fill="#334155">[3] IEEE Computer Society, "Formatting Standards for Authors," 2025.</text>
            </g>
          </g>

          <!-- Pie -->
          <line x1="50" y1="785" x2="545" y2="785" stroke="#cbd5e1" stroke-width="0.8"/>
          <text x="50" y="802" font-family="'Times New Roman', serif" font-size="9" fill="#64748b">IEEE Transactions on Computational Science · Template @preview/charged-ieee:0.1.4</text>
          <text x="545" y="802" text-anchor="end" font-family="'Times New Roman', serif" font-size="9" font-weight="700" fill="#0f172a">1</text>
        </svg>
      `;

    case 'faithful-acmart':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Banner superior ACM -->
          <rect x="50" y="38" width="495" height="28" rx="3" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
          <text x="62" y="55" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#0284c7">ACM ICSE '26</text>
          <text x="135" y="55" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" fill="#64748b">Proceedings of the 2026 International Conference on Software Engineering</text>
          <text x="535" y="55" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" fill="#0284c7">doi.org/10.1145/3643915</text>

          <!-- Titulo ACM -->
          <text x="50" y="95" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill="#0f172a">High-Throughput Reactive Typesetting with Typst Universe</text>

          <!-- Autores estilo ACM -->
          <g transform="translate(50, 115)">
            <text x="0" y="10" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0f172a">DAVID BUENO VALLEJO</text>
            <text x="0" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#64748b">University of Málaga, Spain, bueno@uma.es</text>

            <text x="260" y="10" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0f172a">ELENA MORALES SANZ</text>
            <text x="260" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#64748b">CSIC-UPC Barcelona, Spain, elena.morales@csic.es</text>
          </g>

          <!-- Bloque de Abstract y CCS Concepts ACM -->
          <g transform="translate(50, 155)">
            <rect x="0" y="0" width="495" height="70" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
            <text x="12" y="16" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="800" fill="#0f172a">ABSTRACT</text>
            <text x="12" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#334155">Modern scientific authoring environments demand instant visual feedback. This paper formalizes the</text>
            <text x="12" y="42" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#334155">reactive pipeline behind DBV Typst Editor, demonstrating linear memory scaling and sub-16ms latencies.</text>
            <text x="12" y="58" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="700" fill="#475569">CCS CONCEPTS • Software and its engineering → Compilers; Real-time system software.</text>
          </g>

          <!-- 2 columnas ACM -->
          <!-- Columna 1 -->
          <g transform="translate(50, 240)">
            <text x="0" y="14" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#0f172a">1 INTRODUCTION</text>
            <rect x="0" y="24" width="230" height="4.5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="32" width="230" height="4.5" rx="2" fill="#e2e8f0"/>
            <rect x="0" y="40" width="180" height="4.5" rx="2" fill="#e2e8f0"/>

            <!-- Codigo de ejemplo ACM -->
            <rect x="0" y="55" width="230" height="65" rx="4" fill="#0f172a"/>
            <text x="12" y="75" font-family="'Consolas', monospace" font-size="8.5" fill="#38bdf8">#import "@preview/cetz:0.5.2"</text>
            <text x="12" y="90" font-family="'Consolas', monospace" font-size="8.5" fill="#f8fafc">#cetz.canvas({</text>
            <text x="24" y="105" font-family="'Consolas', monospace" font-size="8.5" fill="#a7f3d0">  import cetz.draw: *</text>
            <text x="12" y="115" font-family="'Consolas', monospace" font-size="8.5" fill="#f8fafc">})</text>

            <rect x="0" y="130" width="230" height="4.5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="138" width="230" height="4.5" rx="2" fill="#e2e8f0"/>
            <rect x="0" y="146" width="210" height="4.5" rx="2" fill="#e2e8f0"/>
          </g>

          <!-- Columna 2 -->
          <g transform="translate(315, 240)">
            <text x="0" y="14" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#0f172a">2 ARCHITECTURAL FORMULATION</text>
            <rect x="0" y="24" width="230" height="4.5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="32" width="230" height="4.5" rx="2" fill="#e2e8f0"/>

            <!-- Box acm reference -->
            <rect x="0" y="48" width="230" height="52" rx="4" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
            <text x="10" y="65" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" font-weight="700" fill="#0284c7">ACM Reference Format:</text>
            <text x="10" y="78" font-family="'Segoe UI', Roboto, sans-serif" font-size="8" fill="#475569">David Bueno Vallejo and Elena Morales Sanz. 2026. High-Throughput</text>
            <text x="10" y="90" font-family="'Segoe UI', Roboto, sans-serif" font-size="8" fill="#475569">Reactive Typesetting with Typst Universe. In ICSE '26, pp. 101–112.</text>

            <text x="0" y="120" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#0f172a">3 EMPIRICAL RESULTS</text>
            <rect x="0" y="130" width="230" height="4.5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="138" width="230" height="4.5" rx="2" fill="#e2e8f0"/>
          </g>

          <!-- Pie -->
          <line x1="50" y1="785" x2="545" y2="785" stroke="#cbd5e1" stroke-width="1"/>
          <text x="50" y="802" font-family="'Segoe UI', Roboto, sans-serif" font-size="8.5" fill="#64748b">ACM ICSE 2026 · Template @preview/faithful-acmart:0.1.0</text>
          <text x="545" y="802" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#0284c7">101</text>
        </svg>
      `;

    case 'springer-spaniel':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Encabezado superior Springer LNCS -->
          <text x="70" y="45" font-family="'Times New Roman', serif" font-size="9" fill="#64748b">D. Bueno Vallejo and E. Morales Sanz</text>
          <text x="525" y="45" text-anchor="end" font-family="'Times New Roman', serif" font-size="9" fill="#64748b">Reactive Document Systems</text>
          <line x1="70" y1="52" x2="525" y2="52" stroke="#cbd5e1" stroke-width="0.8"/>

          <!-- Titulo Capitulo Springer -->
          <text x="70" y="110" font-family="'Times New Roman', serif" font-size="16" font-style="italic" fill="#64748b">Chapter 14</text>
          <text x="70" y="145" font-family="'Times New Roman', serif" font-size="22" font-weight="700" fill="#0f172a">Incremental Document Synthesis in Modern</text>
          <text x="70" y="175" font-family="'Times New Roman', serif" font-size="22" font-weight="700" fill="#0f172a">Desktop Scientific Environments</text>

          <!-- Autores Springer -->
          <text x="70" y="215" font-family="'Times New Roman', serif" font-size="13" font-weight="700" fill="#0284c7">David Bueno Vallejo¹ and Elena Morales Sanz²</text>
          <text x="70" y="235" font-family="'Times New Roman', serif" font-size="9.5" fill="#64748b">¹ University of Málaga, Department of Computer Science, 29071 Málaga, Spain</text>
          <text x="70" y="248" font-family="'Times New Roman', serif" font-size="9.5" fill="#64748b">² Institut de Robòtica i Informàtica Industrial, CSIC-UPC, 08028 Barcelona, Spain</text>

          <!-- Abstract Indentado Springer -->
          <g transform="translate(100, 275)">
            <text x="0" y="12" font-family="'Times New Roman', serif" font-size="10" font-weight="700" fill="#0f172a">Abstract.</text>
            <text x="45" y="12" font-family="'Times New Roman', serif" font-size="9.5" font-style="italic" fill="#334155">This contributed chapter explores the algorithmic guarantees of reactive</text>
            <text x="0" y="26" font-family="'Times New Roman', serif" font-size="9.5" font-style="italic" fill="#334155">document composition, focusing on the Typst language ecosystem and its integration</text>
            <text x="0" y="40" font-family="'Times New Roman', serif" font-size="9.5" font-style="italic" fill="#334155">with multiplatform desktop applications via Rust sub-process management.</text>
            <text x="0" y="60" font-family="'Times New Roman', serif" font-size="9.5" font-weight="700" fill="#0284c7">Keywords: Typst · Incremental Compilation · Rust Subprocess · Reactive UI</text>
          </g>

          <!-- Seccion Springer 1 Columna ancha -->
          <g transform="translate(70, 365)">
            <text x="0" y="18" font-family="'Times New Roman', serif" font-size="14" font-weight="700" fill="#0f172a">1 Introduction and Motivation</text>
            <rect x="0" y="30" width="455" height="5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="40" width="455" height="5" rx="2" fill="#e2e8f0"/>
            <rect x="0" y="50" width="430" height="5" rx="2" fill="#e2e8f0"/>
            <rect x="0" y="60" width="455" height="5" rx="2" fill="#e2e8f0"/>
            <rect x="0" y="70" width="390" height="5" rx="2" fill="#e2e8f0"/>

            <!-- Teorema Springer -->
            <rect x="0" y="90" width="455" height="60" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
            <text x="14" y="112" font-family="'Times New Roman', serif" font-size="10" font-weight="700" font-style="italic" fill="#0f172a">Theorem 1 (Bounded Latency Guarantee).</text>
            <text x="14" y="128" font-family="'Times New Roman', serif" font-size="9.5" font-style="italic" fill="#334155">Let G be the acyclic dependency graph of document blocks. Under localized leaf</text>
            <text x="14" y="142" font-family="'Times New Roman', serif" font-size="9.5" font-style="italic" fill="#334155">modifications, the compilation runtime satisfies T(n) = O(|Path(v, Root)|) &lt; 16 ms.</text>
          </g>

          <!-- Pie -->
          <line x1="70" y1="785" x2="525" y2="785" stroke="#cbd5e1" stroke-width="0.8"/>
          <text x="70" y="802" font-family="'Times New Roman', serif" font-size="9" fill="#64748b">© Springer Nature Switzerland AG 2026 · LNCS Vol. 14280 · @preview/springer-spaniel:0.1.0</text>
          <text x="525" y="802" text-anchor="end" font-family="'Times New Roman', serif" font-size="9" font-weight="700" fill="#0f172a">287</text>
        </svg>
      `;

    case 'ilm':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Banda superior de acento estilizado ilm -->
          <rect x="0" y="0" width="595" height="14" fill="#1e293b"/>
          <rect x="60" y="45" width="50" height="6" rx="3" fill="#3b82f6"/>

          <!-- Titulo del Libro / Manual ilm -->
          <text x="60" y="100" font-family="'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#0f172a">Diseño de Sistemas Reactivos</text>
          <text x="60" y="130" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="500" fill="#64748b">De los fundamentos de concurrencia a la composición tipográfica moderna</text>

          <!-- Píldora de metadatos ilm -->
          <g transform="translate(60, 150)">
            <rect x="0" y="0" width="310" height="26" rx="13" fill="#eff6ff"/>
            <text x="14" y="17" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#2563eb">David Bueno Vallejo · Manual Técnico · v2.1.1</text>
          </g>

          <line x1="60" y1="195" x2="535" y2="195" stroke="#e2e8f0" stroke-width="1.5"/>

          <!-- Índice preview estructurado -->
          <text x="60" y="230" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#0f172a">Estructura y contenido principal</text>
          <g transform="translate(60, 245)">
            <rect x="0" y="0" width="475" height="110" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            
            <text x="20" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0284c7">Capítulo 01.</text>
            <text x="100" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#1e293b">Arquitecturas basadas en eventos y compilación incremental</text>
            <text x="445" y="30" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">pág. 12</text>

            <text x="20" y="60" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0284c7">Capítulo 02.</text>
            <text x="100" y="60" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#1e293b">Integración de LSP con Tinymist y aislamiento de subprocesos</text>
            <text x="445" y="60" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">pág. 45</text>

            <text x="20" y="90" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0284c7">Capítulo 03.</text>
            <text x="100" y="90" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#1e293b">Ejecución segura de entornos científicos compartidos en Python</text>
            <text x="445" y="90" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">pág. 88</text>
          </g>

          <!-- Callout box característico de ilm con barra lateral -->
          <g transform="translate(60, 380)">
            <rect x="0" y="0" width="475" height="85" rx="4" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1"/>
            <rect x="0" y="0" width="6" height="85" rx="3 0 0 3" fill="#16a34a"/>
            <text x="24" y="26" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#15803d">Nota de Maquetación ilm:</text>
            <text x="24" y="46" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#166534">Esta plantilla ofrece una tipografía limpia y equilibrada para lectura prolongada,</text>
            <text x="24" y="62" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#166534">soportando notas al margen, teoremas numerados y diagramas vectoriales.</text>
          </g>

          <!-- Pie -->
          <line x1="60" y1="785" x2="535" y2="785" stroke="#e2e8f0" stroke-width="1"/>
          <text x="60" y="802" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#94a3b8">ilm book suite · Typst Universe @preview/ilm:2.1.1</text>
          <text x="535" y="802" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#94a3b8">1</text>
        </svg>
      `;

    case 'modern-cv':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Cabecera centrada Awesome-CV -->
          <text x="297" y="55" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#0f172a" letter-spacing="1">DAVID BUENO VALLEJO</text>
          <text x="297" y="76" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#dc2626" letter-spacing="2">INGENIERO DE SOFTWARE &amp; ARQUITECTO DE SISTEMAS</text>

          <!-- Fila de contacto Awesome-CV -->
          <g transform="translate(297, 98)">
            <text x="0" y="0" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">✉ david@buenov.com   ·   🌐 github.com/davidbuenov   ·   📍 Málaga, España   ·   ☎ +34 600 000 000</text>
          </g>

          <line x1="50" y1="115" x2="545" y2="115" stroke="#cbd5e1" stroke-width="1"/>

          <!-- Seccion Experiencia -->
          <g transform="translate(50, 140)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800">
              <tspan fill="#dc2626">EXP</tspan><tspan fill="#0f172a">ERIENCIA LABORAL</tspan>
            </text>
            <line x1="165" y1="-4" x2="495" y2="-4" stroke="#cbd5e1" stroke-width="1"/>

            <!-- Entrada 1 -->
            <g transform="translate(0, 22)">
              <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#0f172a">Arquitecto de Software Principal</text>
              <text x="495" y="0" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="600" fill="#dc2626">2024 – Presente</text>
              <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="600" fill="#0284c7">DBV Systems · Málaga, España</text>
              <text x="12" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="9.5" fill="#475569">• Liderazgo técnico del desarrollo de DBV Typst Editor en Rust y Tauri v2.</text>
              <text x="12" y="46" font-family="'Segoe UI', Roboto, sans-serif" font-size="9.5" fill="#475569">• Pipeline de compilación incremental por bandas con latencias inferiores a 16 ms.</text>
              <text x="12" y="60" font-family="'Segoe UI', Roboto, sans-serif" font-size="9.5" fill="#475569">• Integración de LSP Tinymist, galería de plantillas y ejecutor de entornos Python.</text>
            </g>

            <!-- Entrada 2 -->
            <g transform="translate(0, 105)">
              <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#0f172a">Investigador en Sistemas de Alto Rendimiento</text>
              <text x="495" y="0" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="600" fill="#64748b">2021 – 2024</text>
              <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" font-weight="600" fill="#0284c7">Universidad de Málaga · Málaga, España</text>
              <text x="12" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="9.5" fill="#475569">• Publicación de artículos científicos sobre composición tipográfica reactiva.</text>
              <text x="12" y="46" font-family="'Segoe UI', Roboto, sans-serif" font-size="9.5" fill="#475569">• Diseño de algoritmos de sincronización bidireccional y navegación por anclas.</text>
            </g>
          </g>

          <!-- Seccion Educacion -->
          <g transform="translate(50, 325)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800">
              <tspan fill="#dc2626">EDU</tspan><tspan fill="#0f172a">CACIÓN Y TITULACIÓN</tspan>
            </text>
            <line x1="180" y1="-4" x2="495" y2="-4" stroke="#cbd5e1" stroke-width="1"/>

            <g transform="translate(0, 22)">
              <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="700" fill="#0f172a">Máster Universitario en Ingeniería del Software e Inteligencia Artificial</text>
              <text x="495" y="0" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#64748b">2025 – 2026</text>
              <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">Universidad de Málaga</text>
            </g>

            <g transform="translate(0, 52)">
              <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11.5" font-weight="700" fill="#0f172a">Grado en Ingeniería del Software (Premio Extraordinario)</text>
              <text x="495" y="0" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#64748b">2021 – 2025</text>
              <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">Universidad de Málaga</text>
            </g>
          </g>

          <!-- Seccion Habilidades -->
          <g transform="translate(50, 430)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800">
              <tspan fill="#dc2626">HAB</tspan><tspan fill="#0f172a">ILIDADES TÉCNICAS</tspan>
            </text>
            <line x1="165" y1="-4" x2="495" y2="-4" stroke="#cbd5e1" stroke-width="1"/>

            <g transform="translate(0, 20)">
              <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#0f172a">Lenguajes de programación:</text>
              <text x="160" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">Rust, Typst, Python, JavaScript, TypeScript, C++</text>
              
              <text x="0" y="18" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#0f172a">Tecnologías y Frameworks:</text>
              <text x="160" y="18" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">Tauri v2, CodeMirror 6, Linux, Git, WebAssembly, CeTZ</text>
            </g>
          </g>

          <!-- Pie -->
          <line x1="50" y1="785" x2="545" y2="785" stroke="#cbd5e1" stroke-width="1"/>
          <text x="50" y="802" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#94a3b8">modern-cv · Typst Universe @preview/modern-cv:0.10.0</text>
          <text x="545" y="802" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#94a3b8">1 / 2</text>
        </svg>
      `;

    case 'appreciated-letter':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Membrete Remitente (arriba derecha) -->
          <g transform="translate(525, 60)">
            <text x="0" y="0" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#0f172a">David Bueno Vallejo</text>
            <text x="0" y="16" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">Calle Severo Ochoa, 12</text>
            <text x="0" y="30" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">29071 Málaga, España</text>
            <text x="0" y="44" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#0284c7">david@buenov.com</text>
            <text x="0" y="65" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#0f172a">9 de septiembre de 2026</text>
          </g>

          <!-- Bloque Destinatario (arriba izquierda) -->
          <g transform="translate(70, 140)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0f172a">Comité Técnico de Evaluación Científica</text>
            <text x="0" y="16" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">Agencia Estatal de Investigación</text>
            <text x="0" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">Paseo de la Castellana, 162</text>
            <text x="0" y="44" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">28046 Madrid</text>
          </g>

          <!-- Linea de Asunto con fondo sutil -->
          <g transform="translate(70, 220)">
            <rect x="0" y="0" width="455" height="32" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            <text x="14" y="20" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0f172a">Asunto: Presentación formal del entorno de edición científica DBV Typst Editor</text>
          </g>

          <!-- Saludo y cuerpo de la carta -->
          <g transform="translate(70, 280)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#0f172a">Estimados miembros del Comité:</text>
            
            <text x="0" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#334155">Por medio de la presente, me complace remitir la documentación técnica completa del proyecto</text>
            <text x="0" y="46" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#334155">DBV Typst Editor, diseñado como una estación de trabajo reactiva y de alto rendimiento orientada</text>
            <text x="0" y="62" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#334155">a la redacción científica, tesis doctorales y memorias académicas de máxima exigencia.</text>

            <text x="0" y="95" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#334155">El sistema incorpora soporte bidireccional de anclas, compilación incremental por bandas con</text>
            <text x="0" y="111" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#334155">tiempos de respuesta inferiores a 16 milisegundos y un ecosistema curado de paquetes de Typst Universe,</text>
            <text x="0" y="127" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#334155">garantizando una experiencia libre de latencias y completamente reproducible en múltiples plataformas.</text>

            <text x="0" y="160" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#334155">Quedo a su entera disposición para ampliar cualquiera de los puntos tratados o realizar una</text>
            <text x="0" y="176" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#334155">demostración interactiva de las capacidades del entorno.</text>

            <text x="0" y="220" font-family="'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#334155">Agradeciendo de antemano su atención y consideración, les saluda atentamente,</text>

            <!-- Firma vectorial elegante -->
            <g transform="translate(0, 245)">
              <path d="M10 30 Q 35 5, 60 25 T 120 15 Q 150 35, 180 20" fill="none" stroke="#1d4ed8" stroke-width="2" stroke-linecap="round"/>
              <text x="0" y="55" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0f172a">David Bueno Vallejo</text>
              <text x="0" y="70" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">Director de Proyecto &amp; Desarrollador Principal</text>
            </g>
          </g>

          <!-- Pie -->
          <line x1="70" y1="785" x2="525" y2="785" stroke="#cbd5e1" stroke-width="1"/>
          <text x="70" y="802" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#94a3b8">Typst Official Letter Template @preview/appreciated-letter:0.1.0 · Firma digital</text>
        </svg>
      `;

    case 'dbv-tfg':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Franja superior institucional -->
          <rect x="50" y="45" width="495" height="4" fill="#0284c7" rx="2"/>
          
          <!-- Cabecera Institucional -->
          <g transform="translate(60, 70)">
            <circle cx="28" cy="28" r="24" fill="#f0f9ff" stroke="#0284c7" stroke-width="2"/>
            <path d="M28 14 L37 36 L19 36 Z" fill="#0284c7"/>
            <circle cx="28" cy="27" r="4" fill="#ffffff"/>
            <text x="68" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#0f172a" letter-spacing="1">UNIVERSIDAD DE MÁLAGA</text>
            <text x="68" y="40" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#64748b">ESCUELA TÉCNICA SUPERIOR DE INGENIERÍA INFORMÁTICA</text>
          </g>

          <line x1="60" y1="135" x2="535" y2="135" stroke="#e2e8f0" stroke-width="1.5"/>

          <!-- Grado y Tipo de Trabajo -->
          <text x="297" y="180" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#0284c7" letter-spacing="2">GRADO EN INGENIERÍA DEL SOFTWARE</text>
          <text x="297" y="215" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="600" fill="#475569" letter-spacing="1">TRABAJO DE FIN DE GRADO</text>

          <!-- Titulo Principal -->
          <rect x="80" y="250" width="435" height="120" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
          <text x="297" y="295" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#0f172a">Diseño e Implementación de un Sistema</text>
          <text x="297" y="325" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#0f172a">Distribuido de Alto Rendimiento</text>
          <text x="297" y="352" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#64748b">con Compilación Incremental Reactiva</text>

          <!-- Resumen de Contenido -->
          <g transform="translate(80, 400)">
            <text x="0" y="16" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#1e293b">Resumen de la memoria:</text>
            <rect x="0" y="26" width="435" height="6" rx="3" fill="#cbd5e1"/>
            <rect x="0" y="38" width="410" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="0" y="50" width="435" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="0" y="62" width="370" height="6" rx="3" fill="#e2e8f0"/>
          </g>

          <!-- Caja de Datos del Alumno y Tutor -->
          <rect x="80" y="510" width="435" height="180" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
          <g transform="translate(105, 540)">
            <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">AUTOR:</text>
            <text x="0" y="36" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#0f172a">David Bueno Vallejo</text>

            <text x="0" y="75" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">TUTOR ACADÉMICO:</text>
            <text x="0" y="96" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#1e293b">Dr. Alejandro Ramos Martín</text>

            <text x="240" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">DEPARTAMENTO:</text>
            <text x="240" y="36" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#334155">Lenguajes y Ciencias de la Computación</text>

            <text x="240" y="75" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">CONVOCATORIA:</text>
            <text x="240" y="96" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#0284c7">Julio 2026</text>
          </g>

          <!-- Pie de página -->
          <line x1="80" y1="730" x2="515" y2="730" stroke="#f1f5f9" stroke-width="1"/>
          <text x="297" y="760" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#94a3b8">Málaga · Curso Académico 2025/2026</text>
        </svg>
      `;

    case 'dbv-tfm':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Franja superior institucional azul marino -->
          <rect x="50" y="45" width="495" height="5" fill="#1e3a8a" rx="2"/>
          
          <g transform="translate(60, 70)">
            <rect x="0" y="4" width="46" height="46" rx="6" fill="#1e3a8a"/>
            <text x="23" y="34" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#ffffff">M</text>
            <text x="68" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#0f172a" letter-spacing="1">UNIVERSIDAD DE MÁLAGA</text>
            <text x="68" y="40" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#4338ca">MÁSTER UNIVERSITARIO EN INGENIERÍA INFORMÁTICA</text>
          </g>

          <line x1="60" y1="135" x2="535" y2="135" stroke="#e2e8f0" stroke-width="1.5"/>

          <text x="297" y="210" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="700" fill="#1e3a8a" letter-spacing="2">TRABAJO DE FIN DE MÁSTER</text>

          <rect x="75" y="250" width="445" height="120" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
          <text x="297" y="295" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="800" fill="#0f172a">Arquitectura y Evaluación de Sistemas</text>
          <text x="297" y="325" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="800" fill="#0f172a">Reactivos de Composición Científica</text>
          <text x="297" y="352" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#64748b">Especialidad en Inteligencia Artificial y Computación de Altas Prestaciones</text>

          <!-- Bloque de investigación avanzada -->
          <g transform="translate(80, 400)">
            <text x="0" y="16" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#1e293b">Líneas de investigación y aportaciones clave:</text>
            <rect x="0" y="28" width="435" height="6" rx="3" fill="#cbd5e1"/>
            <rect x="0" y="40" width="390" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="0" y="52" width="420" height="6" rx="3" fill="#e2e8f0"/>
          </g>

          <rect x="75" y="500" width="445" height="190" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
          <g transform="translate(105, 535)">
            <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">ALUMNO / AUTOR:</text>
            <text x="0" y="36" font-family="'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#0f172a">David Bueno Vallejo</text>

            <text x="0" y="75" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">DIRECTORES DEL TRABAJO:</text>
            <text x="0" y="96" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#1e293b">Dr. Alejandro Ramos Martín</text>
            <text x="0" y="116" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#1e293b">Dra. Elena Morales Sanz</text>

            <text x="240" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b">CALIFICACIÓN / FECHA:</text>
            <text x="240" y="36" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#1e3a8a">Convocatoria Extraordinaria 2026</text>
          </g>

          <text x="297" y="760" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#94a3b8">Málaga · 2026</text>
        </svg>
      `;

    case 'dbv-articulo':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Encabezado de revista / Preprint -->
          <text x="50" y="45" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#94a3b8" letter-spacing="1">REVISTA IBEROAMERICANA DE INFORMÁTICA · VOL. 24, Nº 2, 2026</text>
          <line x1="50" y1="55" x2="545" y2="55" stroke="#cbd5e1" stroke-width="1"/>

          <!-- Titulo del Articulo -->
          <text x="297" y="90" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="800" fill="#0f172a">Compilación Incremental en Tiempo Real para Documentos Científicos:</text>
          <text x="297" y="112" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="800" fill="#0f172a">Arquitectura y Evaluación de Rendimiento con Typst</text>

          <!-- Autores y filiaciones -->
          <text x="297" y="136" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#0284c7">David Bueno Vallejo¹, Elena Morales Sanz²</text>
          <text x="297" y="152" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">¹Universidad de Málaga · ²Instituto de Robótica e Informática Industrial (CSIC)</text>

          <!-- Caja de Abstract / Resumen -->
          <rect x="65" y="172" width="465" height="74" rx="4" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
          <text x="80" y="190" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#334155">Resumen—</text>
          <text x="135" y="190" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">Este trabajo propone una metodología de compilación reactiva por bandas</text>
          <text x="80" y="206" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">que minimiza la latencia de renderizado en entornos de edición científica pesados...</text>
          <text x="80" y="230" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#0284c7">Palabras clave: Typst, Compilación Incremental, Sistemas Reactivos, LSP.</text>

          <!-- Maqueta 2 columnas -->
          <!-- Columna 1 -->
          <g transform="translate(50, 265)">
            <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#0f172a">1. INTRODUCCIÓN</text>
            <rect x="0" y="25" width="230" height="5" rx="2" fill="#94a3b8"/>
            <rect x="0" y="35" width="230" height="5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="45" width="200" height="5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="55" width="230" height="5" rx="2" fill="#cbd5e1"/>

            <!-- Mini Grafica de Rendimiento en Columna 1 -->
            <rect x="0" y="75" width="230" height="130" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
            <text x="115" y="95" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#475569">Latencia de Compilación (ms)</text>
            <line x1="30" y1="175" x2="210" y2="175" stroke="#94a3b8" stroke-width="1"/>
            <line x1="30" y1="175" x2="30" y2="110" stroke="#94a3b8" stroke-width="1"/>
            <!-- Curva de mejora -->
            <path d="M40 165 Q 90 150, 130 135 T 200 115" fill="none" stroke="#0284c7" stroke-width="2.5"/>
            <circle cx="200" cy="115" r="3" fill="#0284c7"/>
            <text x="115" y="195" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#64748b">Fig. 1: Rendimiento frente a tamaño de documento</text>

            <rect x="0" y="220" width="230" height="5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="230" width="180" height="5" rx="2" fill="#cbd5e1"/>
          </g>

          <!-- Columna 2 -->
          <g transform="translate(315, 265)">
            <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#0f172a">2. MODELO MATEMÁTICO</text>
            <rect x="0" y="25" width="230" height="5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="35" width="230" height="5" rx="2" fill="#cbd5e1"/>

            <!-- Caja de formula matematica -->
            <rect x="0" y="52" width="230" height="42" rx="4" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
            <text x="115" y="78" text-anchor="middle" font-family="'Times New Roman', serif" font-size="14" font-style="italic" fill="#0f172a">E = mc² + ∑ λ_i (x - μ)²</text>

            <text x="0" y="115" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#0f172a">3. RESULTADOS EXPERIMENTALES</text>
            <rect x="0" y="125" width="230" height="5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="135" width="230" height="5" rx="2" fill="#cbd5e1"/>
            <rect x="0" y="145" width="190" height="5" rx="2" fill="#cbd5e1"/>

            <!-- Tabla de datos -->
            <rect x="0" y="165" width="230" height="85" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
            <rect x="0" y="165" width="230" height="22" fill="#f8fafc"/>
            <text x="10" y="180" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#334155">Método</text>
            <text x="100" y="180" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#334155">Tiempo</text>
            <text x="175" y="180" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#334155">Memoria</text>
            <line x1="0" y1="187" x2="230" y2="187" stroke="#cbd5e1" stroke-width="1"/>
            <text x="10" y="202" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#0f172a">DBV Incremental</text>
            <text x="100" y="202" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#16a34a">14 ms</text>
            <text x="175" y="202" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#475569">42 MB</text>
            <text x="10" y="222" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#0f172a">Compilación total</text>
            <text x="100" y="222" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#dc2626">240 ms</text>
            <text x="175" y="222" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#475569">180 MB</text>
          </g>

          <!-- Pie de pagina -->
          <line x1="50" y1="780" x2="545" y2="780" stroke="#cbd5e1" stroke-width="1"/>
          <text x="50" y="798" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" fill="#94a3b8">IEEE Transactions on Document Engineering · Preprint 2026</text>
          <text x="545" y="798" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#94a3b8">1</text>
        </svg>
      `;

    case 'dbv-tesis':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Orla / Marco solemne doble linea -->
          <rect x="35" y="35" width="525" height="772" fill="none" stroke="#334155" stroke-width="2"/>
          <rect x="42" y="42" width="511" height="758" fill="none" stroke="#94a3b8" stroke-width="0.8"/>

          <!-- Escudo institucional universitario con laureles -->
          <g transform="translate(297, 105)">
            <circle cx="0" cy="0" r="32" fill="#f8fafc" stroke="#1e293b" stroke-width="2"/>
            <path d="M-12 -10 L12 -10 L0 16 Z" fill="#1e293b"/>
            <circle cx="0" cy="-2" r="6" fill="#f59e0b"/>
          </g>

          <text x="297" y="165" text-anchor="middle" font-family="'Times New Roman', serif" font-size="16" font-weight="700" fill="#0f172a" letter-spacing="2">UNIVERSIDAD DE MÁLAGA</text>
          <text x="297" y="185" text-anchor="middle" font-family="'Times New Roman', serif" font-size="12" font-style="italic" fill="#475569">PROGRAMA DE DOCTORADO EN TECNOLOGÍAS INFORMÁTICAS</text>

          <line x1="197" y1="210" x2="397" y2="210" stroke="#cbd5e1" stroke-width="1.5"/>

          <text x="297" y="260" text-anchor="middle" font-family="'Times New Roman', serif" font-size="18" font-weight="700" fill="#991b1b" letter-spacing="4">TESIS DOCTORAL</text>

          <!-- Titulo Solemne -->
          <text x="297" y="325" text-anchor="middle" font-family="'Times New Roman', serif" font-size="22" font-weight="700" fill="#0f172a">Arquitecturas Reactivas y Sistemas de</text>
          <text x="297" y="355" text-anchor="middle" font-family="'Times New Roman', serif" font-size="22" font-weight="700" fill="#0f172a">Composición Tipográfica Científica Moderna</text>

          <text x="297" y="430" text-anchor="middle" font-family="'Times New Roman', serif" font-size="13" font-style="italic" fill="#475569">Memoria presentada para optar al grado de Doctor por la Universidad de Málaga</text>
          <text x="297" y="450" text-anchor="middle" font-family="'Times New Roman', serif" font-size="13" font-style="italic" fill="#475569">con Mención Internacional</text>

          <!-- Datos de Autor y Directores -->
          <g transform="translate(297, 530)">
            <text x="0" y="0" text-anchor="middle" font-family="'Times New Roman', serif" font-size="12" fill="#64748b">Por el doctorando:</text>
            <text x="0" y="24" text-anchor="middle" font-family="'Times New Roman', serif" font-size="18" font-weight="700" fill="#0f172a">David Bueno Vallejo</text>

            <text x="0" y="70" text-anchor="middle" font-family="'Times New Roman', serif" font-size="12" fill="#64748b">Directores de la Tesis Doctoral:</text>
            <text x="0" y="92" text-anchor="middle" font-family="'Times New Roman', serif" font-size="15" font-weight="700" fill="#1e293b">Prof. Dr. Alejandro Ramos Martín</text>
            <text x="0" y="112" text-anchor="middle" font-family="'Times New Roman', serif" font-size="15" font-weight="700" fill="#1e293b">Dra. Elena Morales Sanz</text>
          </g>

          <text x="297" y="740" text-anchor="middle" font-family="'Times New Roman', serif" font-size="13" font-weight="600" fill="#334155">Málaga, 2026</text>
        </svg>
      `;

    case 'dbv-informe-tecnico':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Encabezado con banda de acento -->
          <rect x="0" y="0" width="595" height="12" fill="#2563eb"/>
          <rect x="50" y="45" width="8" height="42" rx="3" fill="#2563eb"/>
          <text x="70" y="65" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#2563eb" letter-spacing="1.5">INFORME TÉCNICO · IT-2026-042</text>
          <text x="70" y="85" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#0f172a">Auditoría de Rendimiento y Arquitectura de Software</text>

          <!-- Tarjeta de Metadatos del Informe -->
          <rect x="50" y="110" width="495" height="65" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
          <g transform="translate(70, 132)">
            <text x="0" y="12" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#64748b">PROYECTO:</text>
            <text x="0" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#0f172a">DBV Typst Editor</text>

            <text x="160" y="12" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#64748b">VERSIÓN:</text>
            <text x="160" y="30" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="700" fill="#2563eb">v0.5.0-beta</text>

            <text x="300" y="12" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#64748b">ESTADO:</text>
            <rect x="300" y="18" width="80" height="18" rx="9" fill="#dcfce7"/>
            <text x="340" y="31" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="800" fill="#16a34a">APROBADO</text>
          </g>

          <!-- Callout box Resumen Ejecutivo -->
          <rect x="50" y="195" width="495" height="90" rx="6" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>
          <g transform="translate(70, 220)">
            <circle cx="10" cy="10" r="10" fill="#2563eb"/>
            <text x="10" y="14" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#ffffff">i</text>
            <text x="32" y="14" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#1e40af">Resumen Ejecutivo</text>
            <text x="32" y="36" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#1e3a8a">El análisis de tiempos de respuesta concluye que la compilación incremental por bandas</text>
            <text x="32" y="52" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#1e3a8a">reduce el uso de memoria en un 68% y la latencia perceptible a menos de 16 milisegundos.</text>
          </g>

          <!-- 3 Tarjetas de Métricas KPI -->
          <g transform="translate(50, 305)">
            <rect x="0" y="0" width="155" height="70" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
            <text x="15" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#64748b">LATENCIA MEDIA</text>
            <text x="15" y="52" font-family="'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#16a34a">&lt; 15 ms</text>

            <rect x="170" y="0" width="155" height="70" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
            <text x="185" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#64748b">TESTS UNITARIOS</text>
            <text x="185" y="52" font-family="'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#2563eb">100% OK</text>

            <rect x="340" y="0" width="155" height="70" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
            <text x="355" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#64748b">COMPATIBILIDAD</text>
            <text x="355" y="52" font-family="'Segoe UI', Roboto, sans-serif" font-size="17" font-weight="800" fill="#0f172a">Multiplataforma</text>
          </g>

          <!-- Tabla Técnica de Componentes -->
          <text x="50" y="410" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#0f172a">Detalle de Módulos Evaluados</text>
          <rect x="50" y="425" width="495" height="150" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
          <rect x="50" y="425" width="495" height="28" fill="#f8fafc" rx="6 6 0 0"/>
          <g transform="translate(65, 444)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#475569">Módulo</text>
            <text x="160" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#475569">Tecnología</text>
            <text x="300" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#475569">Resultado</text>
            <text x="410" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#475569">Cobertura</text>
          </g>
          <line x1="50" y1="453" x2="545" y2="453" stroke="#cbd5e1" stroke-width="1"/>
          
          <!-- Fila 1 -->
          <g transform="translate(65, 475)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#0f172a">Tinymist LSP</text>
            <text x="160" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#64748b">Rust Subprocess</text>
            <text x="300" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#16a34a">Operativo</text>
            <text x="410" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#0f172a">100%</text>
          </g>
          <line x1="50" y1="488" x2="545" y2="488" stroke="#f1f5f9" stroke-width="1"/>

          <!-- Fila 2 -->
          <g transform="translate(65, 510)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#0f172a">Python Runner</text>
            <text x="160" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#64748b">Shared AppData Venv</text>
            <text x="300" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#16a34a">Operativo</text>
            <text x="410" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#0f172a">98.4%</text>
          </g>
          <line x1="50" y1="523" x2="545" y2="523" stroke="#f1f5f9" stroke-width="1"/>

          <!-- Fila 3 -->
          <g transform="translate(65, 545)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#0f172a">CeTZ Diagrams</text>
            <text x="160" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#64748b">Typst Universe</text>
            <text x="300" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#16a34a">Operativo</text>
            <text x="410" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#0f172a">100%</text>
          </g>

          <!-- Pie -->
          <line x1="50" y1="780" x2="545" y2="780" stroke="#cbd5e1" stroke-width="1"/>
          <text x="50" y="798" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#94a3b8">Documento generado con DBV Typst Editor · Confidencial</text>
        </svg>
      `;

    case 'dbv-presentacion':
      return `
        <svg viewBox="0 0 960 540" width="100%" height="100%" class="template-full-preview-svg template-full-preview-svg--slide" xmlns="http://www.w3.org/2000/svg">
          <rect width="960" height="540" fill="#ffffff" rx="4"/>
          <!-- Decoracion abstracta moderna de fondo -->
          <circle cx="850" cy="80" r="140" fill="#eff6ff" opacity="0.8"/>
          <circle cx="900" cy="120" r="80" fill="#dbeafe" opacity="0.6"/>

          <!-- Barra superior de acento -->
          <rect x="70" y="55" width="60" height="5" rx="2.5" fill="#2563eb"/>

          <!-- Titulo de Diapositiva -->
          <text x="70" y="130" font-family="'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="900" fill="#0f172a">DBV Typst Editor</text>
          <text x="70" y="170" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="600" fill="#475569">Entorno Científico de Próxima Generación para Composición Tipográfica</text>

          <!-- Ponente y Conferencia -->
          <g transform="translate(70, 210)">
            <text x="0" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#2563eb">David Bueno Vallejo</text>
            <text x="160" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" fill="#94a3b8">|</text>
            <text x="180" y="0" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" fill="#64748b">Conferencia Anual de Computación Científica 2026</text>
          </g>

          <line x1="70" y1="240" x2="890" y2="240" stroke="#e2e8f0" stroke-width="1.5"/>

          <!-- 3 Tarjetas Destacadas en formato 16:9 -->
          <g transform="translate(70, 275)">
            <!-- Tarjeta 1 -->
            <rect x="0" y="0" width="255" height="175" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
            <rect x="20" y="20" width="40" height="40" rx="8" fill="#eff6ff"/>
            <text x="40" y="47" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#2563eb">⚡</text>
            <text x="20" y="85" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#0f172a">Reactividad Pura</text>
            <text x="20" y="112" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">Compilación nativa incremental</text>
            <text x="20" y="130" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">en menos de 15 milisegundos.</text>

            <!-- Tarjeta 2 -->
            <rect x="280" y="0" width="255" height="175" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
            <rect x="300" y="20" width="40" height="40" rx="8" fill="#ecfdf5"/>
            <text x="320" y="47" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#059669">🐍</text>
            <text x="300" y="85" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#0f172a">Python Integrado</text>
            <text x="300" y="112" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">Ejecución segura de Matplotlib,</text>
            <text x="300" y="130" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">NumPy y generación de figuras.</text>

            <!-- Tarjeta 3 -->
            <rect x="560" y="0" width="255" height="175" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
            <rect x="580" y="20" width="40" height="40" rx="8" fill="#fef3c7"/>
            <text x="600" y="47" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#d97706">📐</text>
            <text x="580" y="85" font-family="'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" fill="#0f172a">Diagramas CeTZ</text>
            <text x="580" y="112" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">Diagramas de flujo y bloques</text>
            <text x="580" y="130" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">vectoriales de precisión.</text>
          </g>

          <!-- Barra de pie -->
          <rect x="0" y="525" width="960" height="15" fill="#0f172a"/>
          <text x="70" y="505" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#94a3b8">DBV Typst Editor · Touying Presentation Suite</text>
          <text x="890" y="505" text-anchor="end" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#94a3b8">01 / 24</text>
        </svg>
      `;

    case 'dbv-cv':
      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Columna lateral izquierda -->
          <rect x="0" y="0" width="195" height="842" fill="#f8fafc"/>
          <line x1="195" y1="0" x2="195" y2="842" stroke="#e2e8f0" stroke-width="1.5"/>

          <!-- Avatar y datos de contacto en columna lateral -->
          <g transform="translate(97, 85)">
            <circle cx="0" cy="0" r="42" fill="#e2e8f0" stroke="#0284c7" stroke-width="3"/>
            <text x="0" y="8" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800" fill="#0284c7">DBV</text>
          </g>

          <!-- Secciones columna izq -->
          <g transform="translate(25, 160)">
            <text x="0" y="15" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#0f172a" letter-spacing="1">CONTACTO</text>
            <line x1="0" y1="23" x2="145" y2="23" stroke="#cbd5e1" stroke-width="1"/>
            <text x="0" y="42" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#334155">Email:</text>
            <text x="0" y="56" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">david@buenov.com</text>
            <text x="0" y="78" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#334155">Web / Portafolio:</text>
            <text x="0" y="92" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#0284c7">davidbuenov.com</text>
            <text x="0" y="114" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#334155">Ubicación:</text>
            <text x="0" y="128" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">Málaga, España</text>

            <text x="0" y="170" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#0f172a" letter-spacing="1">HABILIDADES</text>
            <line x1="0" y1="178" x2="145" y2="178" stroke="#cbd5e1" stroke-width="1"/>
            
            <rect x="0" y="192" width="65" height="18" rx="9" fill="#e0f2fe"/>
            <text x="32" y="205" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#0369a1">Rust</text>

            <rect x="72" y="192" width="65" height="18" rx="9" fill="#e0f2fe"/>
            <text x="104" y="205" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#0369a1">Typst</text>

            <rect x="0" y="218" width="65" height="18" rx="9" fill="#f1f5f9"/>
            <text x="32" y="231" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#334155">Python</text>

            <rect x="72" y="218" width="65" height="18" rx="9" fill="#f1f5f9"/>
            <text x="104" y="231" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="700" fill="#334155">Tauri</text>

            <text x="0" y="275" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#0f172a" letter-spacing="1">IDIOMAS</text>
            <line x1="0" y1="283" x2="145" y2="283" stroke="#cbd5e1" stroke-width="1"/>
            <text x="0" y="302" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#334155">Español: Nativo</text>
            <text x="0" y="320" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#334155">Inglés: C1 Profesional</text>
          </g>

          <!-- Columna principal derecha -->
          <g transform="translate(225, 60)">
            <text x="0" y="25" font-family="'Segoe UI', Roboto, sans-serif" font-size="26" font-weight="900" fill="#0f172a">David Bueno Vallejo</text>
            <text x="0" y="48" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#0284c7">Ingeniero de Software &amp; Arquitecto de Sistemas</text>

            <!-- Seccion Perfil -->
            <text x="0" y="95" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#0f172a" letter-spacing="1">PERFIL PROFESIONAL</text>
            <line x1="0" y1="105" x2="335" y2="105" stroke="#0284c7" stroke-width="2"/>
            <text x="0" y="125" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">Ingeniero especializado en el desarrollo de herramientas científicas de alto rendimiento,</text>
            <text x="0" y="140" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">arquitecturas reactivas multiplataforma y compiladores incrementales modernos.</text>

            <!-- Seccion Experiencia -->
            <text x="0" y="185" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#0f172a" letter-spacing="1">EXPERIENCIA LABORAL</text>
            <line x1="0" y1="195" x2="335" y2="195" stroke="#0284c7" stroke-width="2"/>

            <text x="0" y="220" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#0f172a">Arquitecto de Software Principal</text>
            <text x="0" y="235" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#0284c7">DBV Systems · 2024 - Presente</text>
            <text x="0" y="252" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">• Liderazgo del diseño de DBV Typst Editor en Rust y Tauri v2.</text>
            <text x="0" y="267" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">• Implementación de pipelines de compilación por bandas en &lt; 20 ms.</text>

            <text x="0" y="305" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#0f172a">Ingeniero de Software Senior</text>
            <text x="0" y="320" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" fill="#0284c7">Tech Innovations · 2021 - 2024</text>
            <text x="0" y="337" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#475569">• Diseño de APIs reactivas de alto rendimiento y tooling para desarrolladores.</text>

            <!-- Seccion Educacion -->
            <text x="0" y="380" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#0f172a" letter-spacing="1">EDUCACIÓN Y TITULACIÓN</text>
            <line x1="0" y1="390" x2="335" y2="390" stroke="#0284c7" stroke-width="2"/>

            <text x="0" y="415" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0f172a">Máster en Ingeniería del Software e IA</text>
            <text x="0" y="430" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">Universidad de Málaga · 2025 - 2026</text>

            <text x="0" y="455" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#0f172a">Grado en Ingeniería del Software</text>
            <text x="0" y="470" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" fill="#64748b">Universidad de Málaga · 2021 - 2025</text>
          </g>
        </svg>
      `;

    case 'dbv-blank':
    default: {
      const isUniverse = templateId && (templateId.includes('@preview') || templateId.includes(':'));
      if (isUniverse) {
        const specText = templateId.startsWith('@preview/') ? templateId : `@preview/${templateId}`;
        return `
          <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
            <rect width="595" height="842" fill="#ffffff" rx="4"/>
            <!-- Franja Typst Universe -->
            <rect x="50" y="45" width="495" height="6" fill="#2563eb" rx="3"/>
            <g transform="translate(60, 75)">
              <rect x="0" y="0" width="36" height="36" rx="8" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5"/>
              <text x="18" y="24" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="18">✦</text>
              <text x="48" y="16" font-family="'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#2563eb" letter-spacing="1">TYPST UNIVERSE TEMPLATE</text>
              <text x="48" y="32" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="800" fill="#0f172a">${specText}</text>
            </g>
            <line x1="60" y1="130" x2="535" y2="130" stroke="#e2e8f0" stroke-width="1.5"/>

            <g transform="translate(60, 160)">
              <text x="0" y="20" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#0f172a">Documento de Plantilla</text>
              <text x="0" y="40" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">Estructura comunitaria distribuida mediante el registro público de Typst</text>

              <rect x="0" y="65" width="475" height="80" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
              <text x="16" y="92" font-family="'Consolas', monospace" font-size="11" fill="#2563eb">#import "${specText}": *</text>
              <text x="16" y="112" font-family="'Consolas', monospace" font-size="11" fill="#0f172a">#show: project.with(title: "Mi Documento")</text>
              <text x="16" y="132" font-family="'Consolas', monospace" font-size="11" fill="#16a34a">// Documento listo para compilar con DBV Typst Editor</text>

              <rect x="0" y="175" width="475" height="6" rx="3" fill="#cbd5e1"/>
              <rect x="0" y="190" width="440" height="6" rx="3" fill="#e2e8f0"/>
              <rect x="0" y="205" width="460" height="6" rx="3" fill="#e2e8f0"/>
              <rect x="0" y="220" width="380" height="6" rx="3" fill="#e2e8f0"/>
            </g>
            <text x="297" y="760" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#94a3b8">Typst Universe · 1</text>
          </svg>
        `;
      }

      return `
        <svg viewBox="0 0 595 842" width="100%" height="100%" class="template-full-preview-svg" xmlns="http://www.w3.org/2000/svg">
          <rect width="595" height="842" fill="#ffffff" rx="4"/>
          <!-- Guías de margen tenues -->
          <rect x="55" y="55" width="485" height="732" fill="none" stroke="#f1f5f9" stroke-dasharray="4 4" stroke-width="1"/>

          <!-- Titulo inicial -->
          <g transform="translate(70, 95)">
            <text x="0" y="24" font-family="'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#0f172a">= Mi Primer Documento</text>
            <text x="0" y="48" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">Plantilla en blanco: escribe con la velocidad del texto plano</text>

            <line x1="0" y1="68" x2="455" y2="68" stroke="#e2e8f0" stroke-width="1.5"/>

            <!-- Lineas de texto de ejemplo -->
            <rect x="0" y="90" width="455" height="6" rx="3" fill="#cbd5e1"/>
            <rect x="0" y="104" width="430" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="0" y="118" width="455" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="0" y="132" width="360" height="6" rx="3" fill="#e2e8f0"/>

            <!-- Bloque de codigo Typst de bienvenida -->
            <rect x="0" y="165" width="455" height="95" rx="6" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
            <text x="16" y="195" font-family="'Consolas', 'Courier New', monospace" font-size="11" fill="#0284c7">#set page(paper: "a4", margin: (x: 2cm, y: 2.5cm))</text>
            <text x="16" y="215" font-family="'Consolas', 'Courier New', monospace" font-size="11" fill="#0284c7">#set text(font: "Linux Libertine", size: 11pt)</text>
            <text x="16" y="238" font-family="'Consolas', 'Courier New', monospace" font-size="11" fill="#16a34a">// ¡Empieza a escribir aquí!</text>

            <rect x="0" y="285" width="455" height="6" rx="3" fill="#cbd5e1"/>
            <rect x="0" y="299" width="440" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="0" y="313" width="390" height="6" rx="3" fill="#e2e8f0"/>
          </g>

          <text x="297" y="760" text-anchor="middle" font-family="'Segoe UI', Roboto, sans-serif" font-size="11" fill="#94a3b8">1</text>
        </svg>
      `;
    }
  }
}


