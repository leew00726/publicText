REQUIRED_FONTS = [
    "方正小标宋简",
    "仿宋_GB2312",
    "楷体_GB2312",
    "黑体",
]

PAGE_SPEC = {
    "paper": "A4",
    "marginsCm": {"top": 3.7, "bottom": 3.5, "left": 2.7, "right": 2.5},
    "lineSpacingPt": 28,
    "grid": {"rows": 22, "charsPerLine": 28},
}

STYLE_SPEC = {
    "BODY": {"font": "仿宋_GB2312", "sizePt": 16, "lineSpacingPt": 28, "firstLineIndentChars": 2},
    "H1": {"font": "黑体", "sizePt": 16, "punctuation": "none"},
    "H2": {"font": "楷体_GB2312", "sizePt": 16, "punctuation": "optional"},
    "H3": {"font": "仿宋_GB2312", "sizePt": 16, "punctuation": "required"},
    "H4": {"font": "仿宋_GB2312", "sizePt": 16, "punctuation": "required"},
    "TITLE": {"font": "方正小标宋简", "sizePt": 22},
}


def default_redhead_template_a(unit_id: str, unit_name: str) -> dict:
    return {
        "unitId": unit_id,
        "name": "模板A（简版）",
        "version": 1,
        "status": "published",
        "isDefault": True,
        "scope": "firstPageOnly",
        "note": "内置简版红头",
        "page": {
            "paper": "A4",
            "marginsCm": {"top": 3.7, "bottom": 3.5, "left": 2.7, "right": 2.5},
        },
        "elements": [
            {
                "id": "unit-name",
                "enabled": True,
                "type": "text",
                "bind": "unitName",
                "fixedText": None,
                "visibleIfEmpty": False,
                "x": {"anchor": "center", "offsetCm": 0},
                "yCm": 1.0,
                "text": {
                    "align": "center",
                    "font": {
                        "family": "方正小标宋简",
                        "sizePt": 22,
                        "bold": False,
                        "color": "#D40000",
                        "letterSpacingPt": 0,
                    },
                },
                "line": None,
            },
            {
                "id": "red-line",
                "enabled": True,
                "type": "line",
                "bind": "fixedText",
                "fixedText": None,
                "visibleIfEmpty": False,
                "x": {"anchor": "marginLeft", "offsetCm": 0},
                "yCm": 2.2,
                "text": None,
                "line": {
                    "lengthMode": "contentWidth",
                    "lengthCm": None,
                    "thicknessPt": 1.5,
                    "color": "#D40000",
                },
            },
        ],
    }


def default_redhead_template_b(unit_id: str, unit_name: str) -> dict:
    return {
        "unitId": unit_id,
        "name": "模板B（常见版）",
        "version": 1,
        "status": "published",
        "isDefault": False,
        "scope": "firstPageOnly",
        "note": "内置常见红头",
        "page": {
            "paper": "A4",
            "marginsCm": {"top": 3.7, "bottom": 3.5, "left": 2.7, "right": 2.5},
        },
        "elements": [
            {
                "id": "copy-no",
                "enabled": True,
                "type": "text",
                "bind": "copyNo",
                "fixedText": None,
                "visibleIfEmpty": False,
                "x": {"anchor": "marginLeft", "offsetCm": 0},
                "yCm": 0.8,
                "text": {
                    "align": "left",
                    "font": {
                        "family": "仿宋_GB2312",
                        "sizePt": 12,
                        "bold": False,
                        "color": "#000000",
                        "letterSpacingPt": 0,
                    },
                },
                "line": None,
            },
            {
                "id": "unit-name",
                "enabled": True,
                "type": "text",
                "bind": "unitName",
                "fixedText": None,
                "visibleIfEmpty": False,
                "x": {"anchor": "center", "offsetCm": 0},
                "yCm": 1.0,
                "text": {
                    "align": "center",
                    "font": {
                        "family": "方正小标宋简",
                        "sizePt": 22,
                        "bold": False,
                        "color": "#D40000",
                        "letterSpacingPt": 0,
                    },
                },
                "line": None,
            },
            {
                "id": "red-line",
                "enabled": True,
                "type": "line",
                "bind": "fixedText",
                "fixedText": None,
                "visibleIfEmpty": False,
                "x": {"anchor": "marginLeft", "offsetCm": 0},
                "yCm": 2.2,
                "text": None,
                "line": {
                    "lengthMode": "contentWidth",
                    "lengthCm": None,
                    "thicknessPt": 1.5,
                    "color": "#D40000",
                },
            },
            {
                "id": "doc-no",
                "enabled": True,
                "type": "text",
                "bind": "docNo",
                "fixedText": None,
                "visibleIfEmpty": False,
                "x": {"anchor": "marginLeft", "offsetCm": 0},
                "yCm": 2.45,
                "text": {
                    "align": "left",
                    "font": {
                        "family": "仿宋_GB2312",
                        "sizePt": 16,
                        "bold": False,
                        "color": "#000000",
                        "letterSpacingPt": 0,
                    },
                },
                "line": None,
            },
            {
                "id": "signatory",
                "enabled": True,
                "type": "text",
                "bind": "signatory",
                "fixedText": None,
                "visibleIfEmpty": False,
                "x": {"anchor": "marginRight", "offsetCm": 0},
                "yCm": 2.45,
                "text": {
                    "align": "right",
                    "font": {
                        "family": "仿宋_GB2312",
                        "sizePt": 16,
                        "bold": False,
                        "color": "#000000",
                        "letterSpacingPt": 0,
                    },
                },
                "line": None,
            },
        ],
    }
