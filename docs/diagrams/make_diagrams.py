"""Generates the project diagrams as SVG (and PNG when PyMuPDF is installed).

    python docs/diagrams/make_diagrams.py

  er_diagram.svg          ER diagram in Chen notation (entities, attributes, relationships,
                          cardinality, participation, specialisation)
  relational_schema.svg   tables with PK / FK columns and the references between them
  architecture.svg        system architecture of the web application
"""
import math
import os
from xml.sax.saxutils import escape

OUT = os.path.dirname(os.path.abspath(__file__))
FONT = "Segoe UI, Arial, Helvetica, sans-serif"
INK = "#1e293b"
MUTED = "#64748b"


class Svg:
    def __init__(self, width, height):
        self.width, self.height = width, height
        self.back, self.front = [], []

    def line(self, pts, color=INK, width=1.4, dash=None, double=False, layer="back", arrow=False):
        d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        marker = ' marker-end="url(#arrow)"' if arrow else ""
        target = self.back if layer == "back" else self.front
        if double:
            target.append(f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="{width + 3.2}"/>')
            target.append(f'<polyline points="{d}" fill="none" stroke="#ffffff" stroke-width="{width + 0.2}"/>')
        else:
            target.append(f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="{width}"{dash_attr}{marker}/>')

    def text(self, x, y, s, size=12, weight="normal", color=INK, anchor="middle", underline=False, italic=False):
        deco = ' text-decoration="underline"' if underline else ""
        style = ' font-style="italic"' if italic else ""
        self.front.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
            f'fill="{color}" text-anchor="{anchor}" dominant-baseline="central"{deco}{style}>{escape(s)}</text>')

    def shape(self, s):
        self.front.append(s)

    def save(self, name):
        body = "\n".join(self.back + self.front)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.width}" height="{self.height}" '
               f'viewBox="0 0 {self.width} {self.height}">\n'
               '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
               f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker></defs>\n'
               f'<rect width="100%" height="100%" fill="#ffffff"/>\n{body}\n</svg>\n')
        path = os.path.join(OUT, f"{name}.svg")
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg)
        try:
            import pymupdf
            doc = pymupdf.open(path)
            doc[0].get_pixmap(dpi=110).save(os.path.join(OUT, f"{name}.png"))
        except Exception as exc:  # PNG export is optional
            print(f"  (png skipped for {name}: {exc})")
        print(f"  wrote {name}.svg")


def text_width(s, size=12):
    return len(s) * size * 0.56


# ======================================================================== ER diagram (Chen)
# Layout: LOST_ITEM (top) and FOUND_ITEM (bottom) are joined by five vertical lanes,
# USER | CLAIM | MATCHES | CATEGORY | LOCATION. The claim workflow and the USER
# specialisation sit between the USER and CLAIM lanes, so no two edges cross.
ER_W, ER_H = 3000, 2120

ENTITIES = {
    # name: (x, y)
    "PERMISSION": (120, 450),
    "ROLE": (560, 450),
    "NOTIFICATION": (135, 850),
    "USER": (560, 850),
    "STUDENT_PROFILE": (700, 1250),
    "STAFF_PROFILE": (1000, 1300),
    "DEPARTMENT": (700, 1680),
    "CLAIM": (1420, 850),
    "VERIFICATION": (1280, 1420),
    "ITEM_RETURN": (1300, 1740),
    "LOST_ITEM": (1760, 230),
    "FOUND_ITEM": (1760, 1900),
    "CATEGORY": (2150, 1060),
    "LOCATION": (2700, 1060),
    "BUILDING": (2700, 640),
}

ISA_POS = (700, 1030)        # specialisation triangle: USER -> STUDENT_PROFILE / STAFF_PROFILE
SUB_OF_POS = (2400, 1060)    # recursive relationship on CATEGORY, drawn to its right

# name: (x, y, label, [(entity, cardinality, total_participation)])
RELATIONSHIPS = {
    "GRANTS": (340, 450, "GRANTS", [("ROLE", "M", False), ("PERMISSION", "N", False)]),
    "HAS_ROLE": (560, 650, "HAS ROLE", [("USER", "N", True), ("ROLE", "1", False)]),
    "RECEIVES": (345, 850, "RECEIVES", [("USER", "1", False), ("NOTIFICATION", "N", True)]),
    "REPORTS_LOST": (1160, 540, "REPORTS LOST", [("USER", "1", False), ("LOST_ITEM", "N", True)]),
    "REPORTS_FOUND": (560, 1900, "REPORTS FOUND", [("USER", "1", False), ("FOUND_ITEM", "N", True)]),
    "MAKES": (990, 850, "MAKES", [("USER", "1", False), ("CLAIM", "N", True)]),
    "BELONGS_TO": (700, 1470, "BELONGS TO", [("STUDENT_PROFILE", "N", True), ("DEPARTMENT", "1", False)]),
    "VERIFIES": (1140, 1360, "VERIFIES", [("STAFF_PROFILE", "1", False), ("VERIFICATION", "N", True)]),
    "HANDLES": (1000, 1560, "HANDLES", [("STAFF_PROFILE", "1", False), ("ITEM_RETURN", "N", True)]),
    "DECIDED_BY": (1350, 1135, "DECIDED BY", [("CLAIM", "1", False), ("VERIFICATION", "1", True)]),
    "CLOSED_BY": (1480, 1560, "CLOSED BY", [("CLAIM", "1", False), ("ITEM_RETURN", "1", True)]),
    "SUPPORTED_BY": (1590, 540, "SUPPORTED BY", [("CLAIM", "N", False), ("LOST_ITEM", "1", False)]),
    "CLAIM_FOR": (1590, 1375, "FOR", [("CLAIM", "N", True), ("FOUND_ITEM", "1", False)]),
    "MATCHES": (1760, 1060, "MATCHES", [("LOST_ITEM", "M", False), ("FOUND_ITEM", "N", False)]),
    "LOST_TYPE": (1955, 645, "OF TYPE", [("LOST_ITEM", "N", True), ("CATEGORY", "1", False)]),
    "FOUND_TYPE": (1955, 1480, "OF TYPE", [("FOUND_ITEM", "N", True), ("CATEGORY", "1", False)]),
    "LAST_SEEN": (2230, 645, "LAST SEEN AT", [("LOST_ITEM", "N", True), ("LOCATION", "1", False)]),
    "FOUND_AT": (2230, 1480, "FOUND AT", [("FOUND_ITEM", "N", True), ("LOCATION", "1", False)]),
    "HELD_AT": (2500, 1750, "HELD AT", [("FOUND_ITEM", "N", True), ("LOCATION", "1", False)]),
    "IN_BUILDING": (2700, 850, "IN", [("LOCATION", "N", True), ("BUILDING", "1", False)]),
}

# optional waypoints for long edges: (relationship, entity) -> list of points between them
WAYPOINTS = {}

# wider boxes for entities that many relationships attach to
ENTITY_WIDTH = {"LOST_ITEM": 300, "FOUND_ITEM": 300, "CLAIM": 200}

# where an edge meets its entity, as an offset from the entity centre (spreads out busy entities
# so their cardinality labels do not pile up); edges without an entry aim at the centre
PORTS = {
    ("REPORTS_LOST", "USER"): (40, -23),
    ("REPORTS_LOST", "LOST_ITEM"): (-130, 23),
    ("SUPPORTED_BY", "LOST_ITEM"): (-65, 23),
    ("MATCHES", "LOST_ITEM"): (0, 23),
    ("LOST_TYPE", "LOST_ITEM"): (65, 23),
    ("LAST_SEEN", "LOST_ITEM"): (130, 23),
    ("REPORTS_FOUND", "FOUND_ITEM"): (-150, 0),
    ("CLAIM_FOR", "FOUND_ITEM"): (-100, -23),
    ("MATCHES", "FOUND_ITEM"): (0, -23),
    ("FOUND_TYPE", "FOUND_ITEM"): (60, -23),
    ("FOUND_AT", "FOUND_ITEM"): (120, -23),
    ("HELD_AT", "FOUND_ITEM"): (150, 0),
    ("SUPPORTED_BY", "CLAIM"): (60, -23),
    ("DECIDED_BY", "CLAIM"): (-50, 23),
    ("CLOSED_BY", "CLAIM"): (20, 23),
    ("CLAIM_FOR", "CLAIM"): (80, 23),
    ("LAST_SEEN", "LOCATION"): (-65, -10),
    ("FOUND_AT", "LOCATION"): (-65, 12),
    ("HELD_AT", "LOCATION"): (-10, 23),
}

# entity / relationship: [(label, dx, dy, kind)]  kind: pk | plain | derived
ATTRIBUTES = {
    "PERMISSION": [("permission_id", -30, -90, "pk"), ("permission_code", 110, -100, "plain"), ("description", 0, 90, "plain")],
    "ROLE": [("role_id", -90, -80, "pk"), ("role_name", 40, -95, "plain"), ("description", 150, -45, "plain")],
    "NOTIFICATION": [("notification_id", -35, -95, "pk"), ("message", 105, -80, "plain"), ("notif_type", -60, 95, "plain"),
                     ("is_read", 55, 100, "plain"), ("created_at", 0, 160, "plain")],
    "USER": [("user_id", -150, -70, "pk"), ("full_name", -80, -110, "plain"), ("phone", 130, -110, "plain"),
             ("email", 210, -45, "plain"), ("password_hash", -170, 85, "plain"), ("is_active", -110, 140, "plain")],
    "STUDENT_PROFILE": [("srn", 145, 55, "plain"), ("year_of_study", 155, 115, "plain")],
    "STAFF_PROFILE": [("designation", 80, -105, "plain"), ("employee_code", 140, -45, "plain")],
    "DEPARTMENT": [("dept_id", 150, -40, "pk"), ("dept_code", 160, 20, "plain"), ("dept_name", 80, 100, "plain")],
    "CLAIM": [("claim_id", -140, -65, "pk"), ("claimed_at", -40, -110, "plain"), ("claim_status", 190, -30, "plain"),
              ("proof_details", 200, 50, "plain")],
    "VERIFICATION": [("verification_id", 110, 60, "pk"), ("decision", -130, 60, "plain"), ("remarks", -80, 130, "plain"),
                     ("verified_at", 50, 140, "plain")],
    "ITEM_RETURN": [("return_id", -130, 80, "pk"), ("returned_at", 0, 100, "plain"), ("id_proof_checked", 160, 70, "plain"),
                    ("handover_status", 170, 0, "plain")],
    "LOST_ITEM": [("lost_id", -250, -40, "pk"), ("title", -140, -100, "plain"), ("description", 10, -110, "plain"),
                  ("lost_date", 170, -100, "plain"), ("status", 275, -40, "plain"), ("color", -285, 30, "plain"),
                  ("brand", 285, 35, "plain")],
    "FOUND_ITEM": [("color", -318, 35, "plain"), ("hidden_marks", -265, 80, "plain"), ("found_id", -176, 114, "pk"),
                   ("title", -61, 133, "plain"), ("description", 61, 133, "plain"), ("found_date", 176, 114, "plain"),
                   ("status", 265, 80, "plain"), ("brand", 318, 35, "plain")],
    "CATEGORY": [("category_id", 30, -95, "pk"), ("category_name", 150, -120, "plain"), ("is_high_value", 30, 105, "plain"),
                 ("full_path", 150, 125, "derived")],
    "LOCATION": [("location_id", 165, -60, "pk"), ("location_name", 185, 0, "plain"), ("floor_no", 165, 60, "plain"),
                 ("is_collection_point", 120, 125, "plain")],
    "BUILDING": [("building_id", 160, -40, "pk"), ("building_name", 170, 30, "plain"), ("zone", 0, -90, "plain")],
    "MATCHES": [("rule_score", -120, -75, "plain"), ("semantic_score", 130, -75, "plain"), ("total_score", -120, 75, "derived"),
                ("match_status", 130, 75, "plain")],
}

CARD_COLOR = "#b91c1c"


def entity_size(name):
    return ENTITY_WIDTH.get(name, max(130, text_width(name, 13) + 34)), 46


def diamond_width(label):
    return max(110, text_width(label, 11) * 1.15 + 56)


def draw_er():
    svg = Svg(ER_W, ER_H)
    svg.text(24, 30, "Smart Campus Lost & Found - ER diagram (Chen notation)", 20, "bold", anchor="start")
    svg.text(24, 56, "rectangle = entity · diamond = relationship · ellipse = attribute (underlined = key, dashed = derived) · "
             "double line = total participation · 1 / N / M = cardinality", 12, color=MUTED, anchor="start")

    # edges first (drawn underneath the shapes); cardinality labels are drawn last, on top
    card_labels = []
    for rname, (rx, ry, _label, ends) in RELATIONSHIPS.items():
        for ent, card, total in ends:
            ex, ey = ENTITIES[ent]
            port = PORTS.get((rname, ent))
            if port:
                ex, ey = ex + port[0], ey + port[1]
            pts = [(rx, ry)] + WAYPOINTS.get((rname, ent), []) + [(ex, ey)]
            svg.line(pts, double=total, width=1.4)
            # cardinality label just outside the entity box, offset to one side of the edge
            (px, py), (qx, qy) = pts[-2], pts[-1]
            dist = math.hypot(qx - px, qy - py) or 1
            ux, uy = (px - qx) / dist, (py - qy) / dist
            w, h = entity_size(ent)
            if port:
                bx, by = qx, qy                      # the port already lies on the box edge
            else:
                reach = min(abs(w / 2 / ux) if ux else 1e9, abs(h / 2 / uy) if uy else 1e9)
                bx, by = qx + ux * reach, qy + uy * reach
            # put the label on whichever side of the edge stays further outside the box
            cx0, cy0 = ENTITIES[ent]
            options = [(bx + ux * 16 + s * -uy * 11, by + uy * 16 + s * ux * 11) for s in (1, -1)]
            lx, ly = max(options, key=lambda p: max(abs(p[0] - cx0) - w / 2, abs(p[1] - cy0) - h / 2))
            card_labels.append((lx, ly, card))

    # recursive relationship on CATEGORY: two edges (parent / child roles) to one diamond
    cx, cy = ENTITIES["CATEGORY"]
    cw, _ = entity_size("CATEGORY")
    sx, sy = SUB_OF_POS
    svg.line([(cx + cw / 2 - 4, cy - 14), (sx, sy - 29)])
    svg.line([(cx + cw / 2 - 4, cy + 14), (sx, sy + 29)])
    svg.text((cx + cw / 2 + sx) / 2 + 4, sy - 40, "parent 1", 11, "bold", CARD_COLOR)
    svg.text((cx + cw / 2 + sx) / 2 + 4, sy + 40, "child N", 11, "bold", CARD_COLOR)

    # specialisation USER -> STUDENT_PROFILE / STAFF_PROFILE (disjoint)
    ux, uy = ENTITIES["USER"]
    tx, ty = ISA_POS
    svg.line([(ux, uy), (tx, ty - 26)])
    for sub in ("STUDENT_PROFILE", "STAFF_PROFILE"):
        svg.line([(tx, ty + 10), ENTITIES[sub]])
    svg.shape(f'<polygon points="{tx},{ty - 28} {tx - 34},{ty + 22} {tx + 34},{ty + 22}" fill="#fef3c7" stroke="{INK}" stroke-width="1.5"/>')
    svg.text(tx, ty + 6, "ISA", 12, "bold")
    svg.text(tx + 44, ty - 14, "disjoint", 11, color=MUTED, anchor="start", italic=True)

    # attributes
    for owner, attrs in ATTRIBUTES.items():
        ox, oy = ENTITIES.get(owner) or RELATIONSHIPS[owner][:2]
        for label, dx, dy, kind in attrs:
            ax, ay = ox + dx, oy + dy
            svg.line([(ox, oy), (ax, ay)], color="#94a3b8", width=1)
            rx = text_width(label, 11.5) / 2 + 12
            dash = ' stroke-dasharray="5 3"' if kind == "derived" else ""
            svg.shape(f'<ellipse cx="{ax}" cy="{ay}" rx="{rx:.1f}" ry="15" fill="#ffffff" stroke="#475569" stroke-width="1.1"{dash}/>')
            svg.text(ax, ay, label, 11.5, underline=(kind == "pk"))

    # relationships (diamonds)
    rels = dict(RELATIONSHIPS)
    rels["SUB_OF"] = (*SUB_OF_POS, "SUBCATEGORY OF", [])
    for rname, (rx, ry, label, _ends) in rels.items():
        w = diamond_width(label)
        h = 58
        svg.shape(f'<polygon points="{rx},{ry - h / 2} {rx + w / 2},{ry} {rx},{ry + h / 2} {rx - w / 2},{ry}" '
                  f'fill="#e0e7ff" stroke="{INK}" stroke-width="1.5"/>')
        svg.text(rx, ry, label, 11, "bold")

    # entities (rectangles)
    for name, (x, y) in ENTITIES.items():
        w, h = entity_size(name)
        svg.shape(f'<rect x="{x - w / 2}" y="{y - h / 2}" width="{w}" height="{h}" rx="3" fill="#dcfce7" stroke="{INK}" stroke-width="1.8"/>')
        svg.text(x, y, name, 13, "bold")

    for lx, ly, card in card_labels:
        svg.text(lx, ly, card, 13, "bold", CARD_COLOR)

    svg.text(24, ER_H - 22, "STAFF_PROFILE is the staff specialisation of USER (shared key user_id). In the tables, verifier_id and "
             "handled_by reference users.user_id; triggers allow only users whose role holds CLAIM_VERIFY / RETURN_RECORD.",
             11.5, color=MUTED, anchor="start")
    svg.save("er_diagram")


# ======================================================================== relational schema
TABLES = {
    # name: (x, y, [(column, type, flags)])   flags: P = primary key, F = foreign key, U = unique
    "roles": (40, 90, [("role_id", "TINYINT", "P"), ("role_name", "VARCHAR(20)", "U"), ("description", "VARCHAR(200)", "")]),
    "permissions": (40, 270, [("permission_id", "SMALLINT", "P"), ("permission_code", "VARCHAR(40)", "U"), ("description", "VARCHAR(200)", "")]),
    "role_permissions": (360, 160, [("role_id", "TINYINT", "PF"), ("permission_id", "SMALLINT", "PF"), ("granted_at", "DATETIME", "")]),
    "users": (360, 400, [("user_id", "INT", "P"), ("full_name", "VARCHAR(80)", ""), ("email", "VARCHAR(120)", "U"),
                         ("phone", "CHAR(10)", ""), ("password_hash", "CHAR(60)", ""), ("role_id", "TINYINT", "F"),
                         ("is_active", "BOOLEAN", ""), ("created_at", "DATETIME", ""), ("last_login_at", "DATETIME", "")]),
    "departments": (40, 760, [("dept_id", "TINYINT", "P"), ("dept_code", "VARCHAR(10)", "U"), ("dept_name", "VARCHAR(80)", "U")]),
    "student_profiles": (40, 520, [("user_id", "INT", "PF"), ("srn", "CHAR(13)", "U"), ("dept_id", "TINYINT", "F"), ("year_of_study", "TINYINT", "")]),
    "staff_profiles": (360, 760, [("user_id", "INT", "PF"), ("employee_code", "VARCHAR(12)", "U"), ("designation", "VARCHAR(60)", "")]),
    "notifications": (40, 940, [("notification_id", "INT", "P"), ("user_id", "INT", "F"), ("notif_type", "VARCHAR(12)", ""),
                                ("message", "VARCHAR(255)", ""), ("link", "VARCHAR(100)", ""), ("is_read", "BOOLEAN", ""), ("created_at", "DATETIME", "")]),
    "lost_items": (760, 90, [("lost_id", "INT", "P"), ("owner_id", "INT", "F"), ("category_id", "SMALLINT", "F"), ("location_id", "SMALLINT", "F"),
                             ("title", "VARCHAR(100)", ""), ("description", "TEXT", ""), ("color", "VARCHAR(12)", ""), ("brand", "VARCHAR(40)", ""),
                             ("lost_date", "DATE", ""), ("status", "VARCHAR(10)", ""), ("created_at", "DATETIME", ""), ("updated_at", "DATETIME", "")]),
    "found_items": (760, 520, [("found_id", "INT", "P"), ("finder_id", "INT", "F"), ("category_id", "SMALLINT", "F"), ("location_id", "SMALLINT", "F"),
                               ("held_at_id", "SMALLINT", "F"), ("title", "VARCHAR(100)", ""), ("description", "TEXT", ""), ("color", "VARCHAR(12)", ""),
                               ("brand", "VARCHAR(40)", ""), ("hidden_marks", "VARCHAR(255)", ""), ("found_date", "DATE", ""), ("status", "VARCHAR(14)", "")]),
    "potential_matches": (1160, 330, [("match_id", "INT", "P"), ("lost_id", "INT", "FU"), ("found_id", "INT", "FU"), ("rule_score", "DECIMAL(5,4)", ""),
                                      ("semantic_score", "DECIMAL(5,4)", ""), ("total_score", "DECIMAL(5,4) GENERATED", ""), ("match_status", "VARCHAR(10)", ""),
                                      ("matched_at", "DATETIME", "")]),
    "categories": (1500, 90, [("category_id", "SMALLINT", "P"), ("category_name", "VARCHAR(50)", "U"), ("parent_category_id", "SMALLINT", "F"),
                              ("is_high_value", "BOOLEAN", "")]),
    "locations": (1500, 330, [("location_id", "SMALLINT", "P"), ("building_id", "TINYINT", "FU"), ("location_name", "VARCHAR(60)", "U"),
                              ("floor_no", "TINYINT", ""), ("is_collection_point", "BOOLEAN", "")]),
    "buildings": (1840, 330, [("building_id", "TINYINT", "P"), ("building_name", "VARCHAR(60)", "U"), ("zone", "VARCHAR(12)", "")]),
    "claims": (1160, 700, [("claim_id", "INT", "P"), ("found_id", "INT", "FU"), ("claimant_id", "INT", "FU"), ("lost_id", "INT", "F"),
                           ("proof_details", "TEXT", ""), ("claim_status", "VARCHAR(10)", ""), ("claimed_at", "DATETIME", "")]),
    "verifications": (1500, 700, [("verification_id", "INT", "P"), ("claim_id", "INT", "FU"), ("verifier_id", "INT", "F"), ("decision", "VARCHAR(10)", ""),
                                  ("remarks", "VARCHAR(255)", ""), ("verified_at", "DATETIME", "")]),
    "item_returns": (1500, 940, [("return_id", "INT", "P"), ("claim_id", "INT", "FU"), ("handled_by", "INT", "F"), ("id_proof_checked", "BOOLEAN", ""),
                                 ("handover_status", "VARCHAR(12)", ""), ("returned_at", "DATETIME", ""), ("remarks", "VARCHAR(255)", "")]),
    "audit_log": (1840, 700, [("log_id", "BIGINT", "P"), ("table_name", "VARCHAR(30)", ""), ("record_id", "INT", ""), ("action", "VARCHAR(10)", ""),
                              ("old_value", "VARCHAR(40)", ""), ("new_value", "VARCHAR(40)", ""), ("changed_by", "INT", ""), ("changed_at", "DATETIME", "")]),
}

# (from table, column, to table, side) side = which edges to use: "r" = right of source -> left of target, etc.
REFERENCES = [
    ("role_permissions", "role_id", "roles", "lr"), ("role_permissions", "permission_id", "permissions", "lr"),
    ("users", "role_id", "roles", "lr"), ("student_profiles", "user_id", "users", "rl"), ("student_profiles", "dept_id", "departments", "ll"),
    ("staff_profiles", "user_id", "users", "ll"), ("notifications", "user_id", "users", "rl"),
    ("lost_items", "owner_id", "users", "ll"), ("lost_items", "category_id", "categories", "rl"), ("lost_items", "location_id", "locations", "rl"),
    ("found_items", "finder_id", "users", "ll"), ("found_items", "category_id", "categories", "rl"), ("found_items", "location_id", "locations", "rl"),
    ("found_items", "held_at_id", "locations", "rl"), ("potential_matches", "lost_id", "lost_items", "ll"),
    ("potential_matches", "found_id", "found_items", "ll"), ("categories", "parent_category_id", "categories", "rr"),
    ("locations", "building_id", "buildings", "rl"), ("claims", "found_id", "found_items", "ll"), ("claims", "claimant_id", "users", "ll"),
    ("claims", "lost_id", "lost_items", "ll"), ("verifications", "claim_id", "claims", "ll"), ("verifications", "verifier_id", "users", "ll"),
    ("item_returns", "claim_id", "claims", "ll"), ("item_returns", "handled_by", "users", "ll"),
]

ROW_H = 21
TABLE_W = 290


def draw_schema():
    svg = Svg(2180, 1180)
    svg.text(24, 30, "Smart Campus Lost & Found - relational schema (MySQL 8)", 20, "bold", anchor="start")
    svg.text(24, 56, "PK = primary key · FK = foreign key · U = unique · arrows point from the foreign key to the referenced primary key",
             12, color=MUTED, anchor="start")

    def row_y(table, column):
        x, y, cols = TABLES[table]
        idx = [c[0] for c in cols].index(column)
        return y + 30 + idx * ROW_H + ROW_H / 2

    lane = {}
    for i, (src, col, dst, side) in enumerate(REFERENCES):
        sx, _, _ = TABLES[src]
        dx, _, _ = TABLES[dst]
        y1 = row_y(src, col)
        y2 = row_y(dst, [c[0] for c in TABLES[dst][2] if "P" in c[2]][0])
        x1 = sx + TABLE_W if side[0] == "r" else sx
        x2 = dx + TABLE_W if side[1] == "r" else dx
        out1 = 14 + (i % 5) * 5
        if side == "rr":
            pts = [(x1, y1), (x1 + 30, y1), (x1 + 30, y2), (x2 + 6, y2)]
        elif side[0] == "l" and side[1] == "l":
            key = round(min(x1, x2))
            lane[key] = lane.get(key, 0) + 1
            gx = min(x1, x2) - 10 - lane[key] * 6
            pts = [(x1, y1), (gx, y1), (gx, y2), (x2 - 6, y2)]
        elif side[0] == "r" and side[1] == "l":
            mid = (x1 + x2) / 2 + out1 - 20
            pts = [(x1, y1), (mid, y1), (mid, y2), (x2 - 6, y2)]
        else:  # left of source -> right of target
            mid = (x1 + x2) / 2 - out1 + 20
            pts = [(x1, y1), (mid, y1), (mid, y2), (x2 + 6, y2)]
        svg.line(pts, color="#6366f1", width=1.2, arrow=True)

    for name, (x, y, cols) in TABLES.items():
        h = 30 + len(cols) * ROW_H + 6
        svg.shape(f'<rect x="{x}" y="{y}" width="{TABLE_W}" height="{h}" rx="6" fill="#ffffff" stroke="#334155" stroke-width="1.4"/>')
        svg.shape(f'<path d="M{x},{y + 6} a6,6 0 0 1 6,-6 h{TABLE_W - 12} a6,6 0 0 1 6,6 v24 h-{TABLE_W} z" fill="#312e81"/>')
        svg.text(x + 12, y + 15, name, 13, "bold", "#ffffff", anchor="start")
        for i, (col, typ, flags) in enumerate(cols):
            cy = y + 30 + i * ROW_H + ROW_H / 2
            tags = " ".join(t for t, f in (("PK", "P"), ("FK", "F"), ("U", "U")) if f in flags)
            color = "#b45309" if "P" in flags else INK
            svg.text(x + 12, cy, col, 11.5, "bold" if "P" in flags else "normal", color, anchor="start", underline="P" in flags)
            svg.text(x + 168, cy, typ, 10.5, color=MUTED, anchor="start")
            if tags:
                svg.text(x + TABLE_W - 10, cy, tags, 10, "bold", "#4f46e5", anchor="end")
    svg.save("relational_schema")


# ======================================================================== architecture
def box(svg, x, y, w, h, title, lines, fill, stroke="#334155", title_color=INK):
    svg.shape(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
    svg.text(x + w / 2, y + 22, title, 14, "bold", title_color)
    for i, ln in enumerate(lines):
        svg.text(x + w / 2, y + 46 + i * 19, ln, 11.5, color="#334155")


def draw_architecture():
    svg = Svg(1500, 1040)
    svg.text(24, 30, "Smart Campus Lost & Found - system architecture", 20, "bold", anchor="start")

    # tiers
    svg.shape('<rect x="20" y="60" width="1460" height="170" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="6 4"/>')
    svg.text(40, 80, "PRESENTATION  (browser)", 12, "bold", MUTED, anchor="start")
    svg.shape('<rect x="20" y="250" width="1460" height="430" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="6 4"/>')
    svg.text(40, 270, "APPLICATION  (Next.js 16 server, Node.js)", 12, "bold", MUTED, anchor="start")
    svg.shape('<rect x="20" y="700" width="1460" height="320" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="6 4"/>')
    svg.text(40, 720, "DATA", 12, "bold", MUTED, anchor="start")

    box(svg, 60, 95, 420, 120, "Student UI", ["report lost / found items", "browse, smart search, claim", "track claims, notifications"], "#ecfeff")
    box(svg, 540, 95, 420, 120, "Staff UI", ["claims queue, verify ownership", "record hand-over", "reports & analytics, SQL Lab"], "#eef2ff")
    box(svg, 1020, 95, 420, 120, "Admin UI", ["users & roles, RBAC matrix", "categories & locations", "vector DB console, audit log"], "#fdf4ff")

    box(svg, 60, 290, 300, 150, "proxy.js", ["runs before every page", "verifies the JWT cookie", "redirects to /login"], "#fff7ed")
    box(svg, 400, 290, 480, 150, "Pages (React Server Components)", ["app/(app)/**/page.js", "read data directly through lib/data.js",
                                                                    "role-aware navigation from permissions"], "#ffffff")
    box(svg, 920, 290, 520, 150, "REST API (Route Handlers)", ["app/api/**/route.js  -  JSON in / out", "auth · lost · found · matches · claims · search",
                                                               "reports · admin · vector · sql-lab"], "#ffffff")

    box(svg, 60, 480, 300, 170, "lib/auth.js + lib/api.js", ["bcrypt password check", "JWT session (httpOnly cookie)", "requirePermission() ->", "SELECT fn_has_permission()"], "#fef2f2")
    box(svg, 400, 480, 300, 170, "lib/data.js · lib/db.js", ["hand-written SQL, mysql2 pool", "views, CTEs, FULLTEXT search", "CALL stored procedures", "SET @app_user_id (audit)"], "#f0fdf4")
    box(svg, 740, 480, 340, 170, "lib/matching.js", ["1. rule candidates (SQL proc)", "2. nearest neighbours (vector DB)", "3. CALL sp_upsert_match", "total = 0.6 rule + 0.4 semantic"], "#eef2ff")
    box(svg, 1120, 480, 320, 170, "lib/embeddings.js · vectorStore.js", ["all-MiniLM-L6-v2 (ONNX, local)", "text -> 384-d vector", "LanceDB create / search /", "update / delete"], "#fdf4ff")

    box(svg, 60, 745, 860, 255, "MySQL 8  -  campus_lostfound  (source of truth)",
        ["18 tables in 3NF with PK / FK / UNIQUE / CHECK constraints and indexes (composite, FULLTEXT)",
         "5 functions: fn_has_permission, fn_rule_match_score, fn_category_root, ...",
         "14 procedures with transactions: sp_submit_claim, sp_verify_claim, sp_record_return, ...",
         "22 triggers: validation, status cascade, notifications, audit log",
         "11 views: vw_found_items_public (no hidden marks), vw_category_tree (recursive CTE), ...",
         "RBAC tables roles / permissions / role_permissions",
         "native MySQL roles: lf_student_role < lf_staff_role < lf_admin_role, app account lf_app"], "#f0fdf4", "#15803d", "#14532d")
    box(svg, 960, 745, 480, 255, "LanceDB vector database (embedded)",
        ["table item_vectors in ./data/lancedb", "one document per lost / found report:",
         "id, kind, status, dates, category, location ...", "+ vector FixedSizeList<Float32>[384]",
         "scalar indexes: BTree(id, category_id),", "Bitmap(kind, status); IVF-PQ when 256+ rows",
         "cosine nearest-neighbour search with filters"], "#fdf4ff", "#a21caf", "#701a75")

    arrows = [
        ((270, 215), (270, 290), "HTTPS"), ((750, 215), (640, 290), "pages"), ((1230, 215), (1180, 290), "fetch JSON"),
        ((210, 440), (210, 480), ""), ((640, 440), (550, 480), ""), ((1180, 440), (910, 480), ""), ((1180, 440), (1280, 480), ""),
        ((550, 650), (490, 745), "SQL"), ((910, 650), (700, 745), "CALL / SELECT"), ((1280, 650), (1200, 745), "vectors"),
        ((210, 650), (300, 745), "fn_has_permission"),
    ]
    for (x1, y1), (x2, y2), label in arrows:
        svg.line([(x1, y1), (x2, y2 - 4)], color="#475569", width=1.6, arrow=True, layer="front")
        if label:
            svg.text((x1 + x2) / 2 + 8, (y1 + y2) / 2, label, 10.5, "bold", "#475569", anchor="start")
    svg.save("architecture")


if __name__ == "__main__":
    draw_er()
    draw_schema()
    draw_architecture()
