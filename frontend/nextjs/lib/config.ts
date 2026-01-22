export const config = {
  // API Keys (should be in environment variables in production)
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY || "d10doh1r01qlsac8fq2gd10doh1r01qlsac8fq30",
  FRED_API_KEY: process.env.FRED_API_KEY || "01b4c1c4a8763cb79b98119a3c32d0a8",
  EOD_API_KEY: process.env.EOD_API_KEY || "692e837b7e7e92.63340340",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",

  // Application
  APP_NAME: "Portfolio Management API",
  APP_VERSION: "2.0.0",
  DEBUG: process.env.NODE_ENV !== "production",

  // Default Financial Parameters
  DEFAULT_RISK_FREE_RATE: 0.045,
  DEFAULT_ERP: 0.055,
  DEFAULT_TAX_RATE: 0.25,
  DEFAULT_TERMINAL_GROWTH: 0.025,
  DEFAULT_FORECAST_YEARS: 10,

  // Valuation Bounds
  MIN_WACC: 0.02,
  MAX_WACC: 0.15,
  MIN_TERMINAL_GROWTH: 0.0,
  MAX_TERMINAL_GROWTH: 0.03,

  // Portfolio Optimization
  DEFAULT_TARGET_RETURN: 0.10,
  MIN_PORTFOLIO_WEIGHT: 0.0,
  MAX_PORTFOLIO_WEIGHT: 0.40,
};
