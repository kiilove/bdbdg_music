import React, { createContext, useContext } from "react";
import { useMediaQuery } from "react-responsive";

const ResponsiveContext = createContext();

export const ResponsiveProvider = ({ children }) => {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  return (
    <ResponsiveContext.Provider value={{ isMobile }}>
      {children}
    </ResponsiveContext.Provider>
  );
};

// 커스텀 훅을 만들어 컨텍스트 접근을 쉽게 합니다.
export const useResponsive = () => {
  return useContext(ResponsiveContext);
};
