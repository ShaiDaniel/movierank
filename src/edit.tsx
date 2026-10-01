import { createContext, useContext } from 'react';
import type { EditMode } from './data';

/** Whether editing is available: 'local' (dev server), 'github' (unlocked on the public site) or null. */
export const EditContext = createContext<EditMode>(null);
export const useEditMode = () => useContext(EditContext);
