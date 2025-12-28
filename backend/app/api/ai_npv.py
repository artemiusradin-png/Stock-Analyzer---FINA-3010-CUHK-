"""
AI NPV API Endpoints
Handles Operating Cash Flow fetching, NPV calculations, and exports
"""
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import io
import os

from app.services.ai_npv_service import AINPVService

# PDF and Excel export libraries
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    Image,
    PageBreak,
    KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

router = APIRouter(prefix="/api/ai-npv", tags=["AI NPV"])

# Pydantic models
class OCFRequest(BaseModel):
    """Request model for fetching OCF data"""
    ticker: str = Field(..., description="Stock ticker symbol (e.g., AAPL, MSFT)")
    years: int = Field(5, ge=1, le=10, description="Number of years of historical data")
    exchange: Optional[str] = Field(None, description="Specific exchange (e.g., NYSE, NASDAQ, TSX)")

class NPVCalculationRequest(BaseModel):
    """Request model for NPV calculation"""
    ticker: Optional[str] = Field(None, description="Stock ticker (optional, for exports)")
    initial_cost: float = Field(..., description="Initial investment (negative for outflow)")
    required_return: float = Field(..., description="Required return as percentage (e.g., 10 for 10%)")
    cash_flows: List[float] = Field(..., description="Annual cash flows")
    include_sensitivity: bool = Field(True, description="Include sensitivity analysis")

class ExportRequest(BaseModel):
    """Request model for PDF/Excel export"""
    ticker: str = Field(..., description="Stock ticker symbol")
    npv_result: dict = Field(..., description="NPV calculation result (base case)")
    sensitivity_result: Optional[dict] = Field(None, description="Sensitivity analysis result")
    format: str = Field("pdf", description="Export format: 'pdf' or 'excel'")
    # New fields for scenario analysis
    scenario_results: Optional[dict] = Field(None, description="All scenario NPV results (low/base/high)")
    scenario_explanations: Optional[dict] = Field(None, description="Scenario explanations from ChatGPT")
    # Company information fields for redesigned PDF
    company_name: Optional[str] = Field(None, description="Full company name")
    exchange: Optional[str] = Field(None, description="Stock exchange")
    currency: Optional[str] = Field("USD", description="Currency code (USD, EUR, GBP, etc.)")
    stock_price: Optional[float] = Field(None, description="Current stock price per share")
    description: Optional[str] = Field(None, description="Company description/overview")

class DetailedAnalysisRequest(BaseModel):
    """Request model for generating detailed scenario analysis"""
    ticker: str = Field(..., description="Stock ticker symbol")
    exchange: Optional[str] = Field(None, description="Specific exchange")
    scenario_results: Optional[dict] = Field(None, description="NPV results for all three scenarios (optional, for context)")


@router.post("/fetch-company-info")
async def fetch_company_info(request: OCFRequest):
    """
    Fetch company information using ChatGPT API

    Returns:
        Company description, exchange, currency, country, and stock price
    """
    try:
        service = AINPVService()
        result = await service.fetch_company_info(request.ticker)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/fetch-dcf-financials")
async def fetch_dcf_financials(request: OCFRequest):
    """
    Fetch comprehensive financial data for DCF valuation using ChatGPT API
    Extracts data from official financial statements

    Returns:
        Complete financial metrics with data sources
    """
    try:
        service = AINPVService()
        result = await service.fetch_dcf_financials(request.ticker, request.exchange)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch DCF financials: {str(e)}")


@router.post("/fetch-cf-scenarios")
async def fetch_cf_scenarios(request: OCFRequest):
    """
    Fetch scenario-based cash flow forecasts (Low/Base/High) using ChatGPT API

    Returns:
        Cash flow scenarios with explanations
    """
    try:
        service = AINPVService()
        years = max(5, min(request.years, 10))  # Clamp to 5-10 years
        result = await service.fetch_cf_scenarios(request.ticker, years, request.exchange)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch CF scenarios: {str(e)}")


@router.post("/fetch-ocf")
async def fetch_ocf(request: OCFRequest):
    """
    Fetch Operating Cash Flow data using ChatGPT API

    DEPRECATED: Use /fetch-cf-scenarios instead for scenario-based forecasts

    Returns:
        OCF data with years and values
    """
    try:
        service = AINPVService()
        result = await service.fetch_ocf_data(request.ticker, request.years, request.exchange)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch OCF data: {str(e)}")


@router.post("/calculate")
async def calculate_npv(request: NPVCalculationRequest):
    """
    Calculate NPV with optional sensitivity analysis

    Returns:
        NPV calculation results with discount table and sensitivity data
    """
    try:
        service = AINPVService()

        # Convert required_return from percentage to decimal
        required_return_decimal = request.required_return / 100

        if request.include_sensitivity:
            result = service.calculate_npv_sensitivity(
                initial_cost=request.initial_cost,
                required_return=required_return_decimal,
                cash_flows=request.cash_flows
            )
        else:
            result = {
                "base_npv": service.calculate_npv(
                    initial_cost=request.initial_cost,
                    required_return=required_return_decimal,
                    cash_flows=request.cash_flows
                ),
                "sensitivity": []
            }

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate NPV: {str(e)}")


@router.post("/generate-detailed-analysis")
async def generate_detailed_analysis(request: DetailedAnalysisRequest):
    """
    Generate detailed 150-word professional scenario analysis for PDF export

    Args:
        ticker: Stock ticker
        exchange: Optional exchange
        scenario_results: Optional NPV results for context

    Returns:
        Dictionary with detailed 150-word analyses for low/base/high scenarios
    """
    try:
        service = AINPVService()

        result = await service.generate_detailed_scenario_analysis(
            ticker=request.ticker,
            exchange=request.exchange,
            scenario_results=request.scenario_results
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate detailed analysis: {str(e)}")


@router.post("/export/pdf")
async def export_pdf(request: ExportRequest):
    """
    Export NPV calculation results as PDF with redesigned layout

    Returns:
        PDF file as downloadable attachment
    """
    try:
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=0.75 * inch,
            rightMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=1 * inch
        )
        elements = []
        styles = getSampleStyleSheet()

        # Extract data
        npv_data = request.npv_result
        currency = getattr(request, 'currency', None) or 'USD'
        currency_symbol = {'USD': '$', 'EUR': '€', 'GBP': '£', 'CAD': 'C$', 'JPY': '¥'}.get(currency, currency)
        generation_date = datetime.utcnow().strftime('%Y-%m-%d')
        hero_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "annualreport2024.png"))

        # ============== COVER PAGE (Revolut Annual Report inspired) ==============
        company_display = request.company_name or request.ticker
        ticker_exchange = f"{request.ticker}" + (f" • {request.exchange}" if request.exchange else "")
        report_year = datetime.utcnow().year

        brand_style = ParagraphStyle(
            'BrandStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12,
            textColor=colors.HexColor('#111827'),
            leading=14,
            spaceAfter=24
        )

        title_year_style = ParagraphStyle(
            'TitleYearStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=44,
            textColor=colors.HexColor('#111827'),
            leading=50,
            spaceAfter=8
        )

        title_main_style = ParagraphStyle(
            'TitleMainStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=36,
            textColor=colors.HexColor('#111827'),
            leading=40,
            spaceAfter=16
        )

        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            textColor=colors.HexColor('#374151'),
            leading=16,
            spaceAfter=60
        )

        footer_style = ParagraphStyle(
            'FooterStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            textColor=colors.HexColor('#6b7280'),
            leading=12,
            spaceBefore=80
        )

        left_stack = [
            Paragraph("Revolut", brand_style),
            Paragraph(str(report_year), title_year_style),
            Paragraph("Annual Report", title_main_style),
            Paragraph(
                "Including consolidated financial statements for the year ended 31 December "
                f"{report_year}",
                subtitle_style
            ),
            Paragraph("Revolut Group Holdings Ltd<br/>Registered number: 12743269", footer_style)
        ]

        hero_img = None
        if os.path.exists(hero_path):
            try:
                hero_img = Image(hero_path, kind='proportional')
                hero_img._restrictSize(3.25 * inch, 6.5 * inch)
            except Exception:
                hero_img = None

        cover_table = Table(
            [[KeepTogether(left_stack), hero_img if hero_img else Spacer(1, 1)]],
            colWidths=[3.25 * inch, 3.25 * inch]
        )
        cover_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 24),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 24),
        ]))
        elements.append(cover_table)
        elements.append(PageBreak())

        # ============== HEADER FOR CONTENT PAGES ==============
        header_meta_style = ParagraphStyle(
            'HeaderMeta',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            textColor=colors.HexColor('#6b7280'),
            spaceAfter=10
        )
        header_title_style = ParagraphStyle(
            'HeaderTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=20,
            textColor=colors.HexColor('#111827'),
            spaceAfter=12,
            leading=24
        )

        header_table = Table(
            [[
                Paragraph("Revolut Valuation Report", header_meta_style),
                Paragraph(f"{generation_date}", header_meta_style)
            ]],
            colWidths=[3.5 * inch, 3.5 * inch]
        )
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(header_table)
        elements.append(Paragraph(f"{company_display}", header_title_style))
        elements.append(Paragraph(ticker_exchange, header_meta_style))
        elements.append(Spacer(1, 0.2 * inch))

        # ============== DATE & PRICE (Minimal) ==============
        stock_price_val = getattr(request, 'stock_price', None)
        meta_info_style = ParagraphStyle(
            'MetaInfoStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            textColor=colors.HexColor('#6b7280'),
            spaceAfter=8
        )

        date_price_data = [[
            Paragraph(f"Report Date: {generation_date}", meta_info_style),
            Paragraph(f"Stock Price: {currency_symbol}{stock_price_val:.2f}" if stock_price_val else "", meta_info_style)
        ]]

        date_price_table = Table(date_price_data, colWidths=[3.5 * inch, 3.5 * inch])
        date_price_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(date_price_table)
        elements.append(Spacer(1, 0.25 * inch))

        # ============== NPV RESULT (Large, prominent) ==============
        npv_label_style = ParagraphStyle(
            'NPVLabelStyle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            textColor=colors.HexColor('#6b7280'),
            spaceAfter=4
        )
        elements.append(Paragraph("Net Present Value", npv_label_style))

        npv_value_style = ParagraphStyle(
            'NPVValueStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=48,
            textColor=colors.HexColor('#000000'),
            spaceAfter=16
        )
        elements.append(Paragraph(f"{currency_symbol}{npv_data['npv']:,.2f}", npv_value_style))

        # Decision (colored indicator)
        decision_color = colors.HexColor('#10b981') if npv_data['decision'].lower() == 'accept' else colors.HexColor('#ef4444')
        decision_style = ParagraphStyle(
            'DecisionStyle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=14,
            textColor=decision_color,
            spaceAfter=20
        )
        elements.append(Paragraph(f"Investment Decision: {npv_data['decision'].upper()}", decision_style))
        elements.append(Spacer(1, 0.15 * inch))

        # ============== COMPANY OVERVIEW ==============
        if request.description:
            section_heading_style = ParagraphStyle(
                'SectionHeading',
                parent=styles['Normal'],
                fontName='Helvetica-Bold',
                fontSize=16,
                textColor=colors.HexColor('#000000'),
                spaceAfter=12,
                spaceBefore=8
            )
            elements.append(Paragraph("Company Overview", section_heading_style))

            overview_text_style = ParagraphStyle(
                'OverviewText',
                parent=styles['Normal'],
                fontName='Helvetica',
                fontSize=10,
                textColor=colors.HexColor('#374151'),
                leading=16,
                alignment=0,
                spaceAfter=16
            )
            elements.append(Paragraph(request.description, overview_text_style))
            elements.append(Spacer(1, 0.15 * inch))

        # ============== VALUATION METRICS (Clean table) ==============
        section_heading_style = ParagraphStyle(
            'SectionHeading',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=16,
            textColor=colors.HexColor('#000000'),
            spaceAfter=12,
            spaceBefore=8
        )
        elements.append(Paragraph("Key Metrics", section_heading_style))

        metrics_data = [
            ['Metric', 'Value'],
            ['Initial Investment', f"{currency_symbol}{npv_data['initial_cost']:,.2f}"],
            ['Required Return', f"{npv_data['required_return']:.2f}%"],
            ['Internal Rate of Return', f"{npv_data['irr']:.2f}%" if npv_data.get('irr') else 'N/A'],
            ['Investment Horizon', f"{npv_data['project_duration']} years"]
        ]

        metrics_table = Table(metrics_data, colWidths=[3.5 * inch, 3.5 * inch])
        metrics_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.white),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#6b7280')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            # Data rows
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#000000')),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
            ('FONTNAME', (1, 1), (1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 1), (-1, -1), 11),
            # Alignment
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            # Padding
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            # Borders - only horizontal lines
            ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.HexColor('#e5e7eb')),
            ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor('#f3f4f6')),
            ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ]))
        elements.append(metrics_table)
        elements.append(Spacer(1, 0.3 * inch))

        # ============== CASH FLOW ANALYSIS ==============
        section_heading_style_2 = ParagraphStyle(
            'SectionHeading2',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=16,
            textColor=colors.HexColor('#000000'),
            spaceAfter=12,
            spaceBefore=8
        )
        elements.append(Paragraph("Cash Flow Analysis", section_heading_style_2))

        # Cash flow breakdown table (minimalist style)
        discount_data = [['Year', 'Cash Flow', 'Discount Factor', 'Present Value']]
        for row in npv_data['discount_table']:
            discount_data.append([
                f"Year {row['year']}" if row['year'] > 0 else "Year 0",
                f"{currency_symbol}{row['cash_flow']:,.2f}",
                f"{row['discount_factor']:.4f}",
                f"{currency_symbol}{row['present_value']:,.2f}"
            ])

        discount_table = Table(discount_data, colWidths=[1.75 * inch, 1.75 * inch, 1.75 * inch, 1.75 * inch])
        discount_table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.white),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#6b7280')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            # Data
            ('TEXTCOLOR', (0, 1), (0, -1), colors.HexColor('#374151')),
            ('TEXTCOLOR', (1, 1), (-1, -1), colors.HexColor('#000000')),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
            ('FONTNAME', (1, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            # Alignment
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            # Padding
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            # Minimal borders
            ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.HexColor('#e5e7eb')),
            ('LINEBELOW', (0, 1), (-1, -2), 0.25, colors.HexColor('#f3f4f6')),
            ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ]))
        elements.append(discount_table)
        elements.append(Spacer(1, 0.3 * inch))

        # ============== SCENARIO ANALYSIS ==============
        if request.scenario_results and request.scenario_explanations:
            scenario_heading_style = ParagraphStyle(
                'ScenarioHeading',
                parent=styles['Normal'],
                fontName='Helvetica-Bold',
                fontSize=16,
                textColor=colors.HexColor('#000000'),
                spaceAfter=12,
                spaceBefore=8
            )
            elements.append(Paragraph("Scenario Analysis", scenario_heading_style))

            # Scenario comparison table (minimalist)
            scenario_data = [['Scenario', 'NPV', 'IRR', 'Decision']]
            for scenario_name in ['low', 'base', 'high']:
                if scenario_name in request.scenario_results:
                    sc_result = request.scenario_results[scenario_name]
                    scenario_data.append([
                        scenario_name.capitalize() + ' Case',
                        f"{currency_symbol}{sc_result['npv']:,.2f}",
                        f"{sc_result['irr']:.2f}%" if sc_result.get('irr') else 'N/A',
                        sc_result['decision'].upper()
                    ])

            scenario_table = Table(scenario_data, colWidths=[1.75 * inch, 1.75 * inch, 1.75 * inch, 1.75 * inch])
            scenario_table.setStyle(TableStyle([
                # Header
                ('BACKGROUND', (0, 0), (-1, 0), colors.white),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#6b7280')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                # Data
                ('TEXTCOLOR', (0, 1), (0, -1), colors.HexColor('#374151')),
                ('TEXTCOLOR', (1, 1), (-1, -1), colors.HexColor('#000000')),
                ('FONTNAME', (0, 1), (0, -1), 'Helvetica'),
                ('FONTNAME', (1, 1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                # Alignment
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                # Padding
                ('TOPPADDING', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                # Minimal borders
                ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.HexColor('#e5e7eb')),
                ('LINEBELOW', (0, 1), (-1, -2), 0.25, colors.HexColor('#f3f4f6')),
                ('LINEBELOW', (0, -1), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ]))
            elements.append(scenario_table)
            elements.append(Spacer(1, 0.3 * inch))

            # Detailed scenario explanations
            for scenario_name, scenario_label in [('low', 'Downside Case'), ('base', 'Base Case'), ('high', 'Upside Case')]:
                if scenario_name in request.scenario_explanations:
                    explanation = request.scenario_explanations[scenario_name]

                    scenario_subtitle_style = ParagraphStyle(
                        f'{scenario_name.capitalize()}Subtitle',
                        parent=styles['Normal'],
                        fontName='Helvetica-Bold',
                        fontSize=13,
                        textColor=colors.HexColor('#000000'),
                        spaceAfter=8,
                        spaceBefore=10
                    )
                    elements.append(Paragraph(scenario_label, scenario_subtitle_style))

                    explanation_text_style = ParagraphStyle(
                        f'{scenario_name.capitalize()}Text',
                        parent=styles['Normal'],
                        fontName='Helvetica',
                        fontSize=9,
                        textColor=colors.HexColor('#4b5563'),
                        leading=14,
                        leftIndent=0,
                        spaceAfter=12
                    )
                    elements.append(Paragraph(explanation, explanation_text_style))

        # ============== FOOTER (Minimalist) ==============
        def add_footer(canvas, doc):
            """Add minimalist footer to all pages"""
            canvas.saveState()

            # Draw thin separator line at top of footer
            footer_top_y = 0.65 * inch
            canvas.setStrokeColor(colors.HexColor('#e5e7eb'))
            canvas.setLineWidth(0.5)
            canvas.line(0.75 * inch, footer_top_y, letter[0] - 0.75 * inch, footer_top_y)

            footer_y = 0.42 * inch

            # ARQAM brand (left side)
            canvas.setFont('Helvetica', 9)
            canvas.setFillColor(colors.HexColor('#000000'))
            canvas.drawString(0.75 * inch, footer_y, 'ARQAM')

            # Tagline (left side, below brand)
            canvas.setFont('Helvetica', 7)
            canvas.setFillColor(colors.HexColor('#9ca3af'))
            canvas.drawString(0.75 * inch, footer_y - 0.12 * inch, 'Investment Analysis & Valuation')

            # Copyright (right-aligned)
            canvas.setFont('Helvetica', 7)
            canvas.setFillColor(colors.HexColor('#9ca3af'))
            copyright_text = f'© {datetime.utcnow().year} ARQAM. All rights reserved.'
            copyright_width = canvas.stringWidth(copyright_text, 'Helvetica', 7)
            canvas.drawString(letter[0] - 0.75 * inch - copyright_width, footer_y, copyright_text)

            canvas.restoreState()

        # Build PDF with footer on last page
        doc.build(elements, onFirstPage=add_footer, onLaterPages=add_footer)
        buffer.seek(0)

        # Return as downloadable file
        filename = f"{request.ticker}_NPV_Valuation_{generation_date}.pdf"
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


@router.post("/export/excel")
async def export_excel(request: ExportRequest):
    """
    Export NPV calculation results as Excel file

    Returns:
        Excel file with Summary, Detailed, and Sensitivity sheets
    """
    try:
        wb = Workbook()

        # Styles
        header_fill = PatternFill(start_color="F4F6F8", end_color="F4F6F8", fill_type="solid")
        header_font = Font(bold=True, size=11)
        center_alignment = Alignment(horizontal="center", vertical="center")
        border = Border(
            left=Side(style='thin', color='E5E5E5'),
            right=Side(style='thin', color='E5E5E5'),
            top=Side(style='thin', color='E5E5E5'),
            bottom=Side(style='thin', color='E5E5E5')
        )

        npv_data = request.npv_result

        # Sheet 1: Summary
        ws1 = wb.active
        ws1.title = "Summary"

        ws1['A1'] = f"NPV Valuation Report: {request.ticker}"
        ws1['A1'].font = Font(bold=True, size=16)
        ws1['A2'] = f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"

        ws1['A4'] = "Net Present Value"
        ws1['B4'] = npv_data['npv']
        ws1['B4'].number_format = '$#,##0.00'
        ws1['A4'].font = header_font

        ws1['A5'] = "Decision"
        ws1['B5'] = npv_data['decision'].upper()
        ws1['A5'].font = header_font

        ws1['A7'] = "Metric"
        ws1['B7'] = "Value"
        ws1['A7'].fill = header_fill
        ws1['B7'].fill = header_fill
        ws1['A7'].font = header_font
        ws1['B7'].font = header_font

        metrics = [
            ("Initial Cost", npv_data['initial_cost']),
            ("Required Return", f"{npv_data['required_return']:.2f}%"),
            ("IRR", f"{npv_data['irr']:.2f}%" if npv_data['irr'] else "N/A"),
            ("Project Duration", f"{npv_data['project_duration']} years")
        ]

        for idx, (metric, value) in enumerate(metrics, start=8):
            ws1[f'A{idx}'] = metric
            ws1[f'B{idx}'] = value

        # Sheet 2: Detailed Breakdown
        ws2 = wb.create_sheet(title="Detailed")

        ws2['A1'] = "Year-by-Year Cash Flow Analysis"
        ws2['A1'].font = Font(bold=True, size=14)

        headers = ['Year', 'Cash Flow', 'Discount Factor', 'Present Value']
        for idx, header in enumerate(headers, start=1):
            cell = ws2.cell(row=3, column=idx, value=header)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_alignment
            cell.border = border

        for row_idx, row_data in enumerate(npv_data['discount_table'], start=4):
            ws2.cell(row=row_idx, column=1, value=f"Year {row_data['year']}" if row_data['year'] > 0 else "Initial")
            ws2.cell(row=row_idx, column=2, value=row_data['cash_flow']).number_format = '$#,##0.00'
            ws2.cell(row=row_idx, column=3, value=row_data['discount_factor']).number_format = '0.0000'
            ws2.cell(row=row_idx, column=4, value=row_data['present_value']).number_format = '$#,##0.00'

        # Sheet 3: Sensitivity Analysis
        if request.sensitivity_result and request.sensitivity_result.get('sensitivity'):
            ws3 = wb.create_sheet(title="Sensitivity")

            ws3['A1'] = "NPV Sensitivity Analysis"
            ws3['A1'].font = Font(bold=True, size=14)

            sens_headers = ['Discount Rate', 'Variation', 'NPV', 'Decision']
            for idx, header in enumerate(sens_headers, start=1):
                cell = ws3.cell(row=3, column=idx, value=header)
                cell.fill = header_fill
                cell.font = header_font
                cell.alignment = center_alignment
                cell.border = border

            for row_idx, row_data in enumerate(request.sensitivity_result['sensitivity'], start=4):
                ws3.cell(row=row_idx, column=1, value=f"{row_data['discount_rate']:.2f}%")
                ws3.cell(row=row_idx, column=2, value=row_data['variation'])
                ws3.cell(row=row_idx, column=3, value=row_data['npv']).number_format = '$#,##0.00'
                ws3.cell(row=row_idx, column=4, value=row_data['decision'].upper())

        # Adjust column widths
        for ws in wb.worksheets:
            for column in ws.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    if cell.value:
                        max_length = max(max_length, len(str(cell.value)))
                ws.column_dimensions[column_letter].width = min(max_length + 2, 30)

        # Save to buffer
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)

        # Return as downloadable file
        filename = f"{request.ticker}_NPV_Valuation_{datetime.utcnow().strftime('%Y-%m-%d')}.xlsx"
        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel file: {str(e)}")
