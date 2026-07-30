import { createContext, useContext, useMemo, useState } from 'react'
import { copy } from '../data/siteContent'

/* eslint-disable react-refresh/only-export-components */
const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en')
  const value = useMemo(() => ({ language, setLanguage, text: copy[language] }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
