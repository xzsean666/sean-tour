import { JWTHelper } from '../helpers/sdk';
import { config } from '../config';

export const jwtHelper = new JWTHelper(config.auth.JWT_SECRET);
