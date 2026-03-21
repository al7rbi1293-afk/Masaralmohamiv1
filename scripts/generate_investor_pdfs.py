#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Iterable

from arabic_reshaper import reshape
from bidi.algorithm import get_display
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
PREVIEW_DIR = ROOT / "tmp" / "pdfs"
FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf")
FONT_NAME = "ArialUnicode"
LOGO_PATH = ROOT / "apps" / "web" / "public" / "masar-logo.png"

DECK_PATH = OUTPUT_DIR / "masar-investor-pitch-deck.pdf"
ONE_PAGER_PATH = OUTPUT_DIR / "masar-investor-one-pager.pdf"
DECK_PREVIEW_PREFIX = PREVIEW_DIR / "masar-investor-pitch-deck"
ONE_PAGER_PREVIEW_PREFIX = PREVIEW_DIR / "masar-investor-one-pager"

NAVY = HexColor("#0B1F3B")
NAVY_DARK = HexColor("#071426")
SLATE_950 = HexColor("#0F172A")
SLATE_800 = HexColor("#1E293B")
SLATE_700 = HexColor("#334155")
SLATE_600 = HexColor("#475569")
SLATE_500 = HexColor("#64748B")
SLATE_300 = HexColor("#CBD5E1")
SLATE_200 = HexColor("#E2E8F0")
SLATE_100 = HexColor("#F1F5F9")
LIGHT_BG = HexColor("#F8FAFC")
EMERALD = HexColor("#16A34A")
EMERALD_DARK = HexColor("#166534")
EMERALD_SOFT = HexColor("#DCFCE7")
BORDER = HexColor("#E2E8F0")
INK = HexColor("#0F172A")
MUTED = HexColor("#475569")


def register_font() -> None:
    if not FONT_PATH.exists():
        raise FileNotFoundError(f"Arabic font not found: {FONT_PATH}")
    try:
        pdfmetrics.getFont(FONT_NAME)
    except KeyError:
        pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))


def rtl(text: str) -> str:
    return get_display(reshape(text.replace("—", "-")))


def width(text: str, size: float, font_name: str = FONT_NAME) -> float:
    return pdfmetrics.stringWidth(rtl(text), font_name, size)


def wrap_rtl(text: str, max_width: float, size: float, font_name: str = FONT_NAME) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        words = paragraph.split()
        current: list[str] = []
        for word in words:
            candidate = " ".join(current + [word])
            if current and width(candidate, size, font_name) > max_width:
                lines.append(" ".join(current))
                current = [word]
            else:
                current.append(word)
        if current:
            lines.append(" ".join(current))
    return lines or [""]


def trim_line_to_width(text: str, max_width: float, size: float, suffix: str = " ...") -> str:
    words = text.split()
    if not words:
        return suffix.strip()
    candidate = text
    while words and width(candidate + suffix, size) > max_width:
        words.pop()
        candidate = " ".join(words)
    return (candidate + suffix).strip()


def draw_text_block(
    c: canvas.Canvas,
    text: str,
    x_right: float,
    y_top: float,
    max_width: float,
    *,
    size: float = 12,
    color=INK,
    leading: float | None = None,
    max_lines: int | None = None,
) -> float:
    leading = leading or size * 1.45
    lines = wrap_rtl(text, max_width, size)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = trim_line_to_width(lines[-1], max_width, size)

    c.setFillColor(color)
    c.setFont(FONT_NAME, size)
    y = y_top
    for line in lines:
        if line:
            c.drawRightString(x_right, y, rtl(line))
        y -= leading
    return y


def draw_badge(
    c: canvas.Canvas,
    text: str,
    x_right: float,
    y_top: float,
    *,
    bg=EMERALD_SOFT,
    fg=EMERALD_DARK,
    size: float = 9,
    padding_x: float = 12,
    padding_y: float = 7,
) -> None:
    text_width = width(text, size)
    box_width = text_width + padding_x * 2
    box_height = size + padding_y * 2
    x = x_right - box_width
    y = y_top - box_height
    c.setFillColor(bg)
    c.roundRect(x, y, box_width, box_height, 12, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont(FONT_NAME, size)
    c.drawRightString(x_right - padding_x, y + padding_y + 1, rtl(text))


def draw_round_box(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    *,
    fill,
    stroke=BORDER,
    radius: float = 18,
    line_width: float = 1,
) -> None:
    c.setLineWidth(line_width)
    c.setStrokeColor(stroke)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def draw_card_title(c: canvas.Canvas, title: str, x_right: float, y_top: float, *, size: float = 15, color=INK) -> float:
    c.setFillColor(color)
    c.setFont(FONT_NAME, size)
    c.drawRightString(x_right, y_top, rtl(title))
    return y_top - size * 1.6


def draw_bullet_list(
    c: canvas.Canvas,
    items: Iterable[str],
    x_right: float,
    y_top: float,
    max_width: float,
    *,
    size: float = 10.5,
    color=MUTED,
    bullet_color=EMERALD,
    item_gap: float = 7,
) -> float:
    y = y_top
    leading = size * 1.45
    for item in items:
        lines = wrap_rtl(item, max_width - 18, size)
        c.setFillColor(bullet_color)
        c.circle(x_right - 4, y - 4, 2.4, fill=1, stroke=0)
        c.setFillColor(color)
        c.setFont(FONT_NAME, size)
        for index, line in enumerate(lines):
            c.drawRightString(x_right - 18, y - (leading * index), rtl(line))
        y -= leading * len(lines) + item_gap
    return y


def draw_metric_card(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    *,
    value: str,
    label: str,
    note: str,
    dark: bool = False,
) -> None:
    fill = SLATE_950 if dark else white
    stroke = HexColor("#1E293B") if dark else BORDER
    value_color = white if dark else NAVY
    label_color = SLATE_200 if dark else INK
    note_color = SLATE_300 if dark else SLATE_500
    draw_round_box(c, x, y, w, h, fill=fill, stroke=stroke, radius=18)
    c.setFillColor(value_color)
    c.setFont(FONT_NAME, 22)
    c.drawRightString(x + w - 18, y + h - 28, rtl(value))
    draw_text_block(c, label, x + w - 18, y + h - 54, w - 36, size=10.5, color=label_color, max_lines=2)
    draw_text_block(c, note, x + w - 18, y + 28, w - 36, size=8.7, color=note_color, leading=12, max_lines=3)


def draw_small_label(c: canvas.Canvas, text: str, x: float, y: float, *, color=SLATE_500) -> None:
    c.setFillColor(color)
    c.setFont(FONT_NAME, 8.5)
    c.drawString(x, y, rtl(text))


def draw_logo(c: canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    if LOGO_PATH.exists():
        c.drawImage(ImageReader(str(LOGO_PATH)), x, y, width=w, height=h, mask="auto", preserveAspectRatio=True)


def deck_footer(c: canvas.Canvas, slide_number: int, total: int, w: float) -> None:
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.8)
    c.line(42, 28, w - 42, 28)
    c.setFillColor(SLATE_500)
    c.setFont(FONT_NAME, 8.5)
    c.drawString(42, 14, rtl("مسار المحامي | مواد استثمارية أولية"))
    c.drawRightString(w - 42, 14, rtl(f"{slide_number} / {total}"))


def deck_cover(c: canvas.Canvas, w: float, h: float) -> None:
    c.setFillColor(NAVY_DARK)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, h - 78, w, 78, fill=1, stroke=0)
    c.setFillColor(EMERALD)
    c.rect(w - 190, 0, 190, h, fill=1, stroke=0)
    draw_logo(c, 48, h - 62, 110, 34)
    draw_badge(c, "ملف المستثمرين | مارس 2026", w - 220, h - 40, bg=HexColor("#0E2A4F"), fg=HexColor("#D1FAE5"))

    c.setFillColor(white)
    c.setFont(FONT_NAME, 31)
    c.drawRightString(w - 232, h - 126, rtl("مسار المحامي"))
    draw_text_block(
        c,
        "منصة اشتراك سحابية عربية متخصصة لتشغيل مكاتب المحاماة والنمو داخل السوق السعودي.",
        w - 232,
        h - 160,
        460,
        size=19,
        color=SLATE_100,
        leading=28,
        max_lines=3,
    )
    draw_text_block(
        c,
        "منتج عمودي جاهز للعرض الاستثماري: تشغيل داخلي للمكتب، تسعير واضح، بوابة عميل، مسار نسخة الشركات عبر ناجز، وطبقة ذكاء قانوني قابلة للتوسع.",
        w - 232,
        h - 248,
        470,
        size=11.5,
        color=SLATE_300,
        leading=18,
        max_lines=4,
    )

    card_y = 68
    card_w = 205
    gap = 18
    starts = [42, 42 + card_w + gap, 42 + (card_w + gap) * 2]
    cards = [
        ("تشغيل المكتب", "عملاء، قضايا، مستندات، مهام، وفوترة من منصة واحدة."),
        ("محركات التوسع", "بوابة عميل، شركاء نجاح، وتجربة مجانية جاهزة للاكتساب."),
        ("ميزة محلية", "واجهة عربية أولًا + مسار نسخة الشركات وتكاملات ناجز."),
    ]
    for x, (title, body) in zip(starts, cards):
        draw_round_box(c, x, card_y, card_w, 112, fill=HexColor("#0F1F37"), stroke=HexColor("#183356"), radius=22)
        c.setFillColor(EMERALD)
        c.setFont(FONT_NAME, 13)
        c.drawRightString(x + card_w - 16, card_y + 86, rtl(title))
        draw_text_block(c, body, x + card_w - 16, card_y + 62, card_w - 32, size=9.7, color=SLATE_300, leading=14, max_lines=4)

    c.setFillColor(SLATE_300)
    c.setFont(FONT_NAME, 8.5)
    c.drawString(42, 34, rtl("السرد في هذه المواد مبني على النسخة الحالية من المشروع ووثائقه الداخلية."))


def deck_opportunity(c: canvas.Canvas, w: float, h: float) -> None:
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    draw_badge(c, "الفرصة", w - 46, h - 34)
    c.setFillColor(NAVY)
    c.setFont(FONT_NAME, 24)
    c.drawRightString(w - 46, h - 62, rtl("لماذا يستحق هذا السوق منتجًا عموديًا؟"))
    draw_text_block(
        c,
        "المكتب القانوني المحلي غالبًا يدير عمله بين ملفات ورسائل ومتابعات يدوية. القيمة هنا ليست في رقمنة مستند واحد، بل في تحويل المكتب كله إلى نظام تشغيلي منضبط.",
        w - 46,
        h - 96,
        430,
        size=11.3,
        color=MUTED,
        leading=18,
        max_lines=4,
    )

    draw_round_box(c, 42, 110, 402, 320, fill=white, stroke=BORDER, radius=26)
    draw_card_title(c, "الأطروحة الاستثمارية", 42 + 402 - 22, 398, size=18, color=NAVY)
    draw_text_block(
        c,
        "مسار المحامي ليس أداة عامة مترجمة للعربية. هو طبقة تشغيل كاملة لمكتب المحاماة العربي، تربط سير العمل اليومي بالإيراد والاحتفاظ والتوسع المؤسسي.",
        42 + 402 - 22,
        360,
        350,
        size=12.2,
        color=INK,
        leading=20,
        max_lines=5,
    )
    draw_bullet_list(
        c,
        [
            "المشكلة متكررة داخل كل مكتب: تشتت القضايا والمستندات والمتابعة والتحصيل.",
            "المنتج الحالي يملك عمقًا تشغيليًا حقيقيًا بدل صفحة تسويقية أو فكرة أولية.",
            "السوق المحلي يحتاج مواءمة عربية وثقة أعلى وتكاملات محلية لا توفرها الأدوات العامة.",
        ],
        42 + 402 - 22,
        250,
        350,
        size=10.5,
    )

    right_x = 472
    box_w = 442
    box_h = 94
    cards = [
        ("المشكلة التشغيلية", "القضية الواحدة تتوزع بين محادثات وملفات ومهام متفرقة، ما يرفع العبء الإداري ويخفض وضوح القرار."),
        ("لماذا الآن", "المنتج موجود، والتسعير موجود، ووثائق الإطلاق والمرحلة التجريبية موجودة. هذا يختصر الانتقال من البرهان التقني إلى البرهان السوقي."),
        ("العميل المستهدف", "المكاتب الصغيرة والمتوسطة أولًا عبر اشتراك ذاتي، ثم نسخة شركات أعلى قيمة عبر ناجز والتكاملات المؤسسية."),
      ]
    y_positions = [336, 226, 116]
    for (title, body), y in zip(cards, y_positions):
        draw_round_box(c, right_x, y, box_w, box_h, fill=HexColor("#FDFEFE"), stroke=BORDER, radius=24)
        c.setFillColor(EMERALD)
        c.circle(right_x + 30, y + box_h - 26, 7, fill=1, stroke=0)
        draw_card_title(c, title, right_x + box_w - 22, y + box_h - 28, size=14, color=NAVY)
        draw_text_block(c, body, right_x + box_w - 22, y + box_h - 54, box_w - 56, size=10.2, color=MUTED, leading=15, max_lines=3)


def deck_product(c: canvas.Canvas, w: float, h: float) -> None:
    c.setFillColor(HexColor("#F6F9FC"))
    c.rect(0, 0, w, h, fill=1, stroke=0)
    draw_badge(c, "المنتج", w - 46, h - 34)
    c.setFillColor(NAVY)
    c.setFont(FONT_NAME, 24)
    c.drawRightString(w - 46, h - 62, rtl("ما الذي بُني داخل المنصة بالفعل"))
    draw_text_block(
        c,
        "هذه الطبقات موجودة في المشروع الحالي ويمكن عرضها كقاعدة منتج ناضجة، لا كمجرد خارطة طريق نظرية.",
        w - 46,
        h - 95,
        460,
        size=11,
        color=MUTED,
        max_lines=2,
    )

    modules = [
        ("إدارة المكتب", ["عملاء وقضايا ومعاملات خاصة.", "أعضاء فريق وصلاحيات دقيقة."]),
        ("المستندات", ["إصدارات وروابط مشاركة مؤقتة.", "بحث وأرشفة وتنظيم للملفات."]),
        ("المهام والتقويم", ["استحقاقات وتنبيهات وأعمال قادمة.", "لوحات متابعة لحركة المكتب."]),
        ("الفوترة والتحصيل", ["عروض أسعار وفواتير وملفات قابلة للتصدير.", "متابعة المدفوع والمتأخر داخل نفس السياق."]),
        ("بوابة العميل", ["دخول برمز تحقق وعرض الملفات المصرح بها.", "تقليل الاستفسارات ورفع الشفافية."]),
        ("ناجز + الذكاء القانوني", ["نسخة شركات بتكاملات محلية.", "مساعد قانوني فوق المستندات والمعرفة."]),
    ]
    card_w = 280
    card_h = 145
    gap_x = 18
    gap_y = 18
    start_x = 42
    start_y = 314

    for index, (title, bullets) in enumerate(modules):
        row = index // 3
        col = index % 3
        x = start_x + col * (card_w + gap_x)
        y = start_y - row * (card_h + gap_y)
        draw_round_box(c, x, y, card_w, card_h, fill=white, stroke=BORDER, radius=24)
        c.setFillColor(EMERALD_SOFT)
        c.circle(x + 26, y + card_h - 26, 12, fill=1, stroke=0)
        c.setFillColor(EMERALD_DARK)
        c.setFont(FONT_NAME, 11)
        c.drawCentredString(x + 26, y + card_h - 30, rtl(str(index + 1)))
        draw_card_title(c, title, x + card_w - 18, y + card_h - 28, size=15, color=NAVY)
        draw_bullet_list(c, bullets, x + card_w - 18, y + card_h - 58, card_w - 36, size=10.2, item_gap=10)


def deck_business_model(c: canvas.Canvas, w: float, h: float) -> None:
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    draw_badge(c, "نموذج الإيراد", w - 46, h - 34)
    c.setFillColor(NAVY)
    c.setFont(FONT_NAME, 24)
    c.drawRightString(w - 46, h - 62, rtl("طبقات دخل واضحة من أول يوم"))
    draw_text_block(
        c,
        "القوة هنا أن المنتج لا يعتمد على مسار واحد فقط: باقات شهرية ذاتية، توسع شركات، شراكات إحالة، وطبقات احتفاظ داخلية.",
        w - 46,
        h - 95,
        470,
        size=11,
        color=MUTED,
        max_lines=3,
    )

    draw_round_box(c, 42, 98, 416, 344, fill=SLATE_950, stroke=SLATE_800, radius=28)
    draw_card_title(c, "التسعير الحالي", 42 + 416 - 22, 416, size=18, color=white)
    pricing = [
        ("المحامي المستقل", "250 ريال", "مقعد واحد", "دخول سريع للممارس الفردي."),
        ("مكتب صغير", "500 ريال", "2 - 5 مقاعد", "تعاون الفريق ومتابعة المهام."),
        ("مكتب متوسط", "750 ريال", "6 - 10 مقاعد", "تقارير وصلاحيات ونمو منضبط."),
        ("نسخة الشركات", "تواصل معنا", "11 - 30 مقعدًا", "تكاملات مؤسسية وناجز."),
    ]
    px = 60
    py = 272
    pw = 180
    ph = 108
    gx = 14
    gy = 14
    for index, (title, price, seats, note) in enumerate(pricing):
        row = index // 2
        col = index % 2
        x = px + col * (pw + gx)
        y = py - row * (ph + gy)
        draw_round_box(c, x, y, pw, ph, fill=HexColor("#111E33"), stroke=HexColor("#203350"), radius=20)
        c.setFillColor(white)
        c.setFont(FONT_NAME, 12.5)
        c.drawRightString(x + pw - 16, y + ph - 22, rtl(title))
        c.setFillColor(EMERALD)
        c.setFont(FONT_NAME, 18)
        c.drawRightString(x + pw - 16, y + ph - 48, rtl(price))
        c.setFillColor(SLATE_300)
        c.setFont(FONT_NAME, 9.2)
        c.drawRightString(x + pw - 16, y + ph - 67, rtl(seats))
        draw_text_block(c, note, x + pw - 16, y + 28, pw - 32, size=8.8, color=SLATE_300, leading=12, max_lines=2)

    right_x = 486
    box_w = 428
    box_h = 98
    cards = [
        ("اشتراك ذاتي منخفض الاحتكاك", "وجود باقات سعرية جاهزة يسهل تحويل الاهتمام إلى تجربة ثم اشتراك دون اعتماد كامل على المبيعات التقليدية."),
        ("نمو عبر الشركاء", "برنامج شركاء النجاح يربط الإحالة بالدفع الناجح فعليًا، ما يخلق قناة اكتساب قابلة للتكرار مع ضبط للعمولات."),
        ("توسع نسخة الشركات", "نسخة الشركات ترفع قيمة الحساب عبر ناجز ورحلات عمل مخصصة، بدل الاكتفاء بسقف تسعيري منخفض."),
    ]
    y_positions = [328, 212, 96]
    for (title, body), y in zip(cards, y_positions):
        draw_round_box(c, right_x, y, box_w, box_h, fill=white, stroke=BORDER, radius=24)
        draw_card_title(c, title, right_x + box_w - 18, y + box_h - 26, size=14.5, color=NAVY)
        draw_text_block(c, body, right_x + box_w - 18, y + box_h - 52, box_w - 36, size=10.2, color=MUTED, leading=15, max_lines=3)


def deck_moat(c: canvas.Canvas, w: float, h: float) -> None:
    c.setFillColor(HexColor("#F7FAFC"))
    c.rect(0, 0, w, h, fill=1, stroke=0)
    draw_badge(c, "الميزة التنافسية", w - 46, h - 34)
    c.setFillColor(NAVY)
    c.setFont(FONT_NAME, 24)
    c.drawRightString(w - 46, h - 62, rtl("لماذا يصعب استبدال المنتج بسرعة"))
    draw_text_block(
        c,
        "ميزة المشروع ليست في خاصية واحدة؛ بل في تراكب مواءمة محلية، ثقة، عمق منتجي، ومسارات توسع متصلة بنفس الحساب.",
        w - 46,
        h - 95,
        470,
        size=11,
        color=MUTED,
        max_lines=3,
    )

    cards = [
        ("عربي أولًا", ["واجهة من اليمين إلى اليسار من الأساس.", "لغة تشغيلية أقرب لواقع المكتب.", "أقل فجوة اعتماد للمستخدم النهائي."]),
        ("الثقة والأمن", ["عزل بيانات لكل مكتب.", "سياسات وصول وصلاحيات وسجل تدقيق.", "حماية للواجهات وخط أساس أمني واضح."]),
        ("موضع محلي مؤسسي", ["ناجز جزء من نسخة الشركات وليس إضافة سطحية.", "رحلة إطلاق ومراقبة خاصة للتكامل.", "قيمة أعلى في السوق المحلي."]),
        ("مركز بيانات للمكتب", ["المستندات والمهام والفوترة في مكان واحد.", "يمهد لذكاء قانوني متصل بالسياق.", "يرفع تكلفة الاستبدال بمنتج جزئي."]),
    ]
    positions = [(42, 252), (500, 252), (42, 86), (500, 86)]
    for (title, bullets), (x, y) in zip(cards, positions):
        draw_round_box(c, x, y, 418, 142, fill=white, stroke=BORDER, radius=24)
        c.setFillColor(EMERALD_SOFT)
        c.rect(x, y + 112, 418, 30, fill=1, stroke=0)
        draw_card_title(c, title, x + 418 - 18, y + 126, size=14.5, color=EMERALD_DARK)
        draw_bullet_list(c, bullets, x + 418 - 18, y + 96, 360, size=10.3, item_gap=8)


def deck_expansion(c: canvas.Canvas, w: float, h: float) -> None:
    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    draw_badge(c, "التوسع", w - 46, h - 34)
    c.setFillColor(NAVY)
    c.setFont(FONT_NAME, 24)
    c.drawRightString(w - 46, h - 62, rtl("كيف ينمو الحساب مع المنتج"))
    draw_text_block(
        c,
        "أفضلية المشروع أن التوسع يحدث داخل نفس المسار: اكتساب عبر التجربة، احتفاظ عبر بوابة العميل، ورفع قيمة عبر الشراكات والنسخة المؤسسية والذكاء القانوني.",
        w - 46,
        h - 95,
        500,
        size=11,
        color=MUTED,
        max_lines=4,
    )

    stages = [
        ("1. اكتساب", "تجربة 14 يوم ومسار بدء التجربة جاهز للمكاتب الجديدة."),
        ("2. اعتماد", "المنصة تصبح مركز العمل اليومي للقضايا والملفات والمهام."),
        ("3. احتفاظ", "بوابة العميل والتحصيل والمشاركة ترفع الالتصاق بالحساب."),
        ("4. رفع قيمة", "نسخة الشركات عبر ناجز والمساعد القانوني يفتحان توسعًا أعلى قيمة."),
    ]
    start_x = 42
    y = 246
    stage_w = 204
    for index, (title, body) in enumerate(stages):
        x = start_x + index * 224
        draw_round_box(c, x, y, stage_w, 168, fill=white, stroke=BORDER, radius=24)
        c.setFillColor(EMERALD)
        c.circle(x + 30, y + 135, 12, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont(FONT_NAME, 9.5)
        c.drawCentredString(x + 30, y + 131, rtl(str(index + 1)))
        draw_card_title(c, title, x + stage_w - 18, y + 138, size=14.5, color=NAVY)
        draw_text_block(c, body, x + stage_w - 18, y + 106, stage_w - 36, size=10.2, color=MUTED, leading=15, max_lines=4)
        if index < len(stages) - 1:
            c.setStrokeColor(EMERALD)
            c.setLineWidth(2.2)
            c.line(x + stage_w + 10, y + 84, x + stage_w + 30, y + 84)
            c.line(x + stage_w + 30, y + 84, x + stage_w + 24, y + 90)
            c.line(x + stage_w + 30, y + 84, x + stage_w + 24, y + 78)

    draw_round_box(c, 42, 74, 874, 118, fill=SLATE_950, stroke=SLATE_800, radius=26)
    draw_card_title(c, "نتيجة هذا التراكب", 42 + 874 - 22, 162, size=17, color=white)
    draw_text_block(
        c,
        "بدل منتج أحادي الوظيفة، يتحول مسار المحامي إلى نظام تشغيل للمكتب. وكل طبقة إضافية داخله ترفع الاحتفاظ وتفتح مسارًا أعلى في الإيراد أو القيمة المؤسسية.",
        42 + 874 - 22,
        132,
        780,
        size=11,
        color=SLATE_300,
        leading=17,
        max_lines=3,
    )


def deck_readiness(c: canvas.Canvas, w: float, h: float) -> None:
    c.setFillColor(HexColor("#F7FAFC"))
    c.rect(0, 0, w, h, fill=1, stroke=0)
    draw_badge(c, "الجاهزية الحالية", w - 46, h - 34)
    c.setFillColor(NAVY)
    c.setFont(FONT_NAME, 24)
    c.drawRightString(w - 46, h - 62, rtl("ما الذي يمكن الحديث عنه بثقة اليوم"))
    draw_text_block(
        c,
        "الملف الحالي يملك أساسًا جيدًا للحديث الاستثماري: بناء فعلي، خطة تشغيل للإطلاق الأول، ومستهدفات تشغيلية قابلة للقياس.",
        w - 46,
        h - 95,
        500,
        size=11,
        color=MUTED,
        max_lines=3,
    )

    draw_round_box(c, 42, 88, 432, 344, fill=white, stroke=BORDER, radius=26)
    draw_card_title(c, "المنجز التشغيلي", 42 + 432 - 20, 404, size=18, color=NAVY)
    draw_bullet_list(
        c,
        [
            "مسار التجربة واكتساب العملاء يعمل حاليًا مع تحويل مباشر إلى المنصة.",
            "إدارة عملاء وقضايا ومستندات ومهام وفواتير وتقارير موجودة داخل المنتج.",
            "بوابة العميل لها وثيقة نطاق ومعايير قبول ومؤشرات نجاح واضحة.",
            "برنامج شركاء النجاح مربوط بالإحالة والدفع الفعلي عبر بوابة الدفع.",
            "نسخة الشركات وناجز لها خطة إطلاق وتشغيل ومراقبة مستقلة.",
        ],
        42 + 432 - 20,
        364,
        372,
        size=10.6,
        item_gap=10,
    )

    c.setFillColor(SLATE_500)
    c.setFont(FONT_NAME, 8.8)
    c.drawRightString(42 + 432 - 20, 110, rtl("الأرقام أدناه هي مستهدفات تشغيلية موثقة، لا نتائج سوقية نهائية بعد."))

    metrics = [
        ("14 يوم", "تجربة مجانية", "ضمن مسار الاكتساب الحالي."),
        ("10 مكاتب", "إطلاق أولي", "خطة تشغيل للمرحلة الأولى."),
        ("30%", "خفض الاستفسارات", "هدف 60-90 يوم لبوابة العميل."),
        ("15-25%", "تحسن السداد", "رفع سرعة التحصيل بعد الإطلاق."),
        ("50%+", "دخول شهري للعملاء", "هدف تبنٍ للعملاء المدعوين."),
        ("5%", "عمولة شريك", "ترتبط بالدفع الناجح فقط."),
    ]
    mx = 502
    my = 300
    mw = 190
    mh = 104
    gx = 18
    gy = 16
    for index, (value, label, note) in enumerate(metrics):
        row = index // 2
        col = index % 2
        x = mx + col * (mw + gx)
        y = my - row * (mh + gy)
        draw_metric_card(c, x, y, mw, mh, value=value, label=label, note=note)


def deck_close(c: canvas.Canvas, w: float, h: float) -> None:
    c.setFillColor(NAVY_DARK)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, 0, w, 84, fill=1, stroke=0)
    draw_badge(c, "الخطوة التالية", w - 46, h - 34, bg=HexColor("#0E2A4F"), fg=HexColor("#D1FAE5"))
    c.setFillColor(white)
    c.setFont(FONT_NAME, 28)
    c.drawRightString(w - 46, h - 72, rtl("هذا مشروع جاهز لحوار استثماري أولي جاد"))
    draw_text_block(
        c,
        "الاحتياج التالي ليس تجميل قصة المنتج، بل تحويل الجاهزية الحالية إلى نتائج موثقة: إطلاق أولي منضبط، أرقام تحويل أولية، وتفعيل إثباتات مؤسسية داخل السوق المحلي.",
        w - 46,
        h - 110,
        520,
        size=11.8,
        color=SLATE_300,
        leading=18,
        max_lines=4,
    )

    cards = [
        ("أولوية 1", "إطلاق المرحلة الأولى على أول 10 مكاتب ومراقبة جودة التحويل من التجربة."),
        ("أولوية 2", "تثبيت قصة نسخة الشركات عبر ناجز والرحلات المؤسسية الأعلى قيمة."),
        ("أولوية 3", "ربط أرقام الاستخدام والتحصيل والاحتفاظ بقرار الاستثمار القادم."),
    ]
    start_x = 42
    y = 128
    w_card = 276
    gap = 22
    for index, (title, body) in enumerate(cards):
        x = start_x + index * (w_card + gap)
        draw_round_box(c, x, y, w_card, 168, fill=HexColor("#111E33"), stroke=HexColor("#203350"), radius=24)
        c.setFillColor(EMERALD)
        c.setFont(FONT_NAME, 13)
        c.drawRightString(x + w_card - 18, y + 138, rtl(title))
        draw_text_block(c, body, x + w_card - 18, y + 106, w_card - 36, size=11, color=SLATE_200, leading=17, max_lines=4)

    draw_round_box(c, 42, 56, 874, 48, fill=HexColor("#0D1B30"), stroke=HexColor("#203350"), radius=18)
    c.setFillColor(white)
    c.setFont(FONT_NAME, 11.5)
    c.drawRightString(894, 73, rtl("للتواصل: masar.almohami@outlook.sa"))
    draw_small_label(c, "مواد صالحة للمشاركة الأولى مع المستثمرين وتحديثها لاحقًا بالأرقام الفعلية.", 42, 72, color=SLATE_300)


def build_deck() -> None:
    total = 8
    width_points = 960
    height_points = 540
    c = canvas.Canvas(str(DECK_PATH), pagesize=(width_points, height_points))
    c.setAuthor("Codex for Masar Al-Muhami")
    c.setTitle("Masar Investor Pitch Deck")
    c.setSubject("Investor pitch deck for Masar Al-Muhami")

    slides = [
        deck_cover,
        deck_opportunity,
        deck_product,
        deck_business_model,
        deck_moat,
        deck_expansion,
        deck_readiness,
        deck_close,
    ]
    for index, slide in enumerate(slides, start=1):
        slide(c, width_points, height_points)
        deck_footer(c, index, total, width_points)
        c.showPage()
    c.save()


def one_pager() -> None:
    c = canvas.Canvas(str(ONE_PAGER_PATH), pagesize=A4)
    page_w, page_h = A4
    c.setAuthor("Codex for Masar Al-Muhami")
    c.setTitle("Masar Investor One Pager")
    c.setSubject("Investor one pager for Masar Al-Muhami")

    c.setFillColor(LIGHT_BG)
    c.rect(0, 0, page_w, page_h, fill=1, stroke=0)

    hero_h = 194
    c.setFillColor(NAVY_DARK)
    c.rect(0, page_h - hero_h, page_w, hero_h, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, page_h - 38, page_w, 38, fill=1, stroke=0)
    draw_logo(c, 36, page_h - 54, 90, 28)
    draw_badge(c, "ملخص استثماري | مارس 2026", page_w - 36, page_h - 20, bg=HexColor("#0E2A4F"), fg=HexColor("#D1FAE5"))
    c.setFillColor(white)
    c.setFont(FONT_NAME, 26)
    c.drawRightString(page_w - 36, page_h - 72, rtl("مسار المحامي"))
    draw_text_block(
        c,
        "منصة اشتراك سحابية عربية متخصصة لتشغيل مكاتب المحاماة: تشغيل داخلي للمكتب، تسعير واضح، بوابة عميل، مسار نسخة الشركات عبر ناجز، وطبقة ذكاء قانوني قابلة للتوسع.",
        page_w - 36,
        page_h - 102,
        390,
        size=11.5,
        color=SLATE_200,
        leading=17,
        max_lines=4,
    )
    draw_text_block(
        c,
        "هذا الملف يلخص القيمة الاستثمارية الحالية بناءً على ما هو مطبق فعليًا داخل المنتج ووثائقه.",
        page_w - 36,
        page_h - 172,
        420,
        size=9.8,
        color=SLATE_300,
        max_lines=2,
    )

    left_x = 36
    right_x = 306
    col_w = 253
    top_y = 500
    row_h = 132
    gap_y = 16

    draw_round_box(c, right_x, top_y, col_w, row_h, fill=white, stroke=BORDER, radius=22)
    draw_card_title(c, "لماذا الآن", right_x + col_w - 16, top_y + row_h - 22, size=15, color=NAVY)
    draw_bullet_list(
        c,
        [
            "المكتب القانوني ما زال يدير أجزاء كبيرة من عمله يدويًا.",
            "السوق المحلي يحتاج مواءمة عربية وثقة أعلى من الأدوات العامة.",
            "المنتج الحالي تجاوز مرحلة الفكرة إلى جاهزية تشغيلية قابلة للقياس.",
        ],
        right_x + col_w - 16,
        top_y + row_h - 52,
        col_w - 28,
        size=9.5,
        item_gap=8,
    )

    draw_round_box(c, left_x, top_y, col_w, row_h, fill=white, stroke=BORDER, radius=22)
    draw_card_title(c, "ما الذي بُني", left_x + col_w - 16, top_y + row_h - 22, size=15, color=NAVY)
    draw_bullet_list(
        c,
        [
            "إدارة عملاء وقضايا ومستندات ومهام وفواتير وتقارير.",
            "بوابة عميل برمز تحقق مع معايير قبول ومؤشرات نجاح محددة.",
            "برنامج شركاء نجاح مربوط بالإحالة والدفع الفعلي.",
            "مسار نسخة الشركات عبر ناجز والمساعد القانوني فوق البيانات القانونية.",
        ],
        left_x + col_w - 16,
        top_y + row_h - 52,
        col_w - 28,
        size=9.2,
        item_gap=7,
    )

    second_row_y = top_y - row_h - gap_y
    draw_round_box(c, right_x, second_row_y, col_w, row_h, fill=white, stroke=BORDER, radius=22)
    draw_card_title(c, "نموذج الإيراد", right_x + col_w - 16, second_row_y + row_h - 22, size=15, color=NAVY)
    draw_bullet_list(
        c,
        [
            "اشتراك ذاتي بثلاث باقات شهرية: 250 و500 و750 ريال.",
            "نسخة شركات أعلى قيمة مع تكاملات ورحلات عمل خاصة.",
            "نمو الشركاء يضيف قناة اكتساب مرتبطة بالدفع الناجح.",
        ],
        right_x + col_w - 16,
        second_row_y + row_h - 52,
        col_w - 28,
        size=9.5,
        item_gap=8,
    )

    draw_round_box(c, left_x, second_row_y, col_w, row_h, fill=white, stroke=BORDER, radius=22)
    draw_card_title(c, "الميزة التنافسية", left_x + col_w - 16, second_row_y + row_h - 22, size=15, color=NAVY)
    draw_bullet_list(
        c,
        [
            "تجربة عربية أولًا بدل تعريب سطحي.",
            "عزل بيانات وصلاحيات وسجل تدقيق من البداية.",
            "وضع محلي أقوى عبر ناجز وطبقة ذكاء متصلة بالبيانات.",
        ],
        left_x + col_w - 16,
        second_row_y + row_h - 52,
        col_w - 28,
        size=9.5,
        item_gap=8,
    )

    bottom_y = 110
    draw_round_box(c, 36, bottom_y, page_w - 72, 162, fill=SLATE_950, stroke=SLATE_800, radius=24)
    draw_card_title(c, "الجاهزية الحالية والمستهدفات", page_w - 52, bottom_y + 150, size=16.5, color=white)
    draw_text_block(
        c,
        "قصة الاستثمار هنا ناضجة بما يكفي لبدء الحوار: المنتج موجود، وثائق الإطلاق موجودة، والمرحلة التالية هي تثبيت نتائج فعلية عبر إطلاق أولي منضبط.",
        page_w - 52,
        bottom_y + 122,
        470,
        size=9.8,
        color=SLATE_300,
        leading=15,
        max_lines=3,
    )

    metric_cards = [
        ("30%", "خفض الاستفسارات", "هدف 60-90 يوم"),
        ("15-25%", "تحسن السداد", "من بوابة العميل"),
        ("50%+", "دخول شهري للعملاء", "هدف تبنٍ"),
    ]
    card_w = 150
    card_h = 74
    for index, (value, label, note) in enumerate(metric_cards):
        x = 36 + index * (card_w + 12)
        draw_metric_card(c, x, bottom_y + 18, card_w, card_h, value=value, label=label, note=note, dark=True)

    draw_text_block(
        c,
        "للتواصل: masar.almohami@outlook.sa\nالمحتوى مبني على النسخة الحالية للمشروع حتى 20 مارس 2026.",
        page_w - 52,
        62,
        260,
        size=8.8,
        color=SLATE_500,
        leading=13,
        max_lines=3,
    )

    c.save()


def cleanup_previews(prefix: Path) -> None:
    for png in prefix.parent.glob(f"{prefix.name}-*.png"):
        png.unlink()


def render_preview(pdf_path: Path, prefix: Path) -> None:
    cleanup_previews(prefix)
    subprocess.run(
        ["pdftoppm", "-png", str(pdf_path), str(prefix)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    register_font()
    build_deck()
    one_pager()
    render_preview(DECK_PATH, DECK_PREVIEW_PREFIX)
    render_preview(ONE_PAGER_PATH, ONE_PAGER_PREVIEW_PREFIX)
    print(f"Created: {DECK_PATH}")
    print(f"Created: {ONE_PAGER_PATH}")


if __name__ == "__main__":
    main()
