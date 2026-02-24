import { z } from 'zod/v4';

/**
 * Initialize Zod with Czech locale for error messages
 * This configures Zod globally to return validation errors in Czech
 */
z.config(z.locales.cs());
