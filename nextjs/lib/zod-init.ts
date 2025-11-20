import { z } from 'zod';

/**
 * Initialize Zod with Czech locale for error messages
 * This configures Zod globally to return validation errors in Czech
 */
z.config(z.locales.cs());
