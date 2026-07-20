import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-data-policy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <h1>Política de uso de datos (fines educativos)</h1>
      <p>
        Esta política describe cómo la Institución utilizará los datos proporcionados por los usuarios
        con fines exclusivamente académicos y de gestión interna del proceso de grado. El propósito
        es asegurar la transparencia y la protección de los datos personales.
      </p>

      <h3>Finalidad</h3>
      <p>
        Los datos recopilados serán utilizados para: gestionar procesos de grado, asignación de
        asesores, notificaciones relacionadas con su trámite, generación de reportes internos y
        cumplimiento de obligaciones académicas. No se utilizarán con fines comerciales.
      </p>

      <h3>Datos recolectados</h3>
      <p>
        Se solicitarán datos de contacto (correo, teléfono), identificación académica (código,
        programa), información de perfil y documentos requeridos para el proceso de grado.
      </p>

      <h3>Conservación y seguridad</h3>
      <p>
        Los datos se conservarán mientras sea necesario para la gestión académica y conforme a
        las políticas institucionales y la legislación aplicable. Se implementan medidas técnicas
        y organizativas básicas para proteger la información.
      </p>

      <h3>Derechos del titular</h3>
      <p>
        Los titulares tienen derecho a acceder, rectificar, solicitar la supresión o limitación del
        tratamiento de sus datos. Para ejercer estos derechos, contacte al administrador del
        sistema o al responsable de tratamiento designado por la institución.
      </p>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 900px; margin: 0 auto; }
    h1 { margin-bottom: 12px; }
    p { margin-bottom: 10px; color: var(--color-text-secondary); }
  `]
})
export class DataPolicyComponent {}