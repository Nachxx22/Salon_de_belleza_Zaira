// Componentes visuales reutilizables (dueña: Persona A).
// Úsenlos en todos los módulos para que la interfaz se vea igual en todas partes.
import { useId } from 'react';

export function Boton({ variante = 'primario', type = 'button', className = '', ...props }) {
  return <button type={type} className={`boton boton--${variante} ${className}`.trim()} {...props} />;
}

// Campo de formulario con etiqueta, ayuda y error accesibles (AC-04, AC-07).
export function Campo({ etiqueta, error, ayuda, obligatorio = false, id, ...props }) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idAyuda = ayuda ? `${idCampo}-ayuda` : undefined;
  const idError = error ? `${idCampo}-error` : undefined;
  return (
    <div className="campo">
      <label htmlFor={idCampo}>
        {etiqueta} {obligatorio && <span className="obligatorio" aria-hidden="true">*</span>}
      </label>
      <input
        id={idCampo}
        required={obligatorio}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[idAyuda, idError].filter(Boolean).join(' ') || undefined}
        {...props}
      />
      {ayuda && <span id={idAyuda} className="campo__ayuda">{ayuda}</span>}
      {error && <span id={idError} className="campo__error">{error}</span>}
    </div>
  );
}

// Mensaje del resultado de una operación (AC-05). Se anuncia a lectores de pantalla.
export function Mensaje({ tipo = 'exito', children }) {
  if (!children) return null;
  return (
    <div className={`mensaje mensaje--${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

// Página provisional para las funciones que todavía no se han programado.
export function EnConstruccion({ titulo, requerimientos, responsable }) {
  return (
    <section className="tarjeta">
      <h1>{titulo}</h1>
      <p className="texto-suave">Esta sección todavía está en construcción.</p>
      <p>
        <strong>Requerimientos:</strong> {requerimientos}
        <br />
        <strong>Responsable:</strong> {responsable}
      </p>
    </section>
  );
}
