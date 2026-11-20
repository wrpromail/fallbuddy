#!/usr/bin/env python3
"""V0 数据与素材校验：JSON Schema + 业务不变量 + rig/背包一致性。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "shaiyouji_implementation_kit"
DATA = ROOT / "build" / "data"
MP = ROOT / "miniprogram"

errors: list[str] = []


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def check_schema(data_label: str, instances, schema_path: Path) -> None:
    schema = load(schema_path)
    validator = Draft202012Validator(schema)
    for index, instance in enumerate(instances):
        for err in validator.iter_errors(instance):
            errors.append(f"{data_label}[{index}] {err.json_path}: {err.message}")


def check_png(rel: str, expected_w: int | None, expected_h: int | None, label: str) -> None:
    path = MP / rel.lstrip("/")
    if not path.exists():
        errors.append(f"{label}: 缺少素材 {rel}")
        return
    with Image.open(path) as im:
        if im.mode != "RGBA" and not (im.mode == "P" and "transparency" in im.info):
            errors.append(f"{label}: {rel} 不是透明 PNG（mode={im.mode}）")
        if expected_w and im.size != (expected_w, expected_h):
            errors.append(f"{label}: {rel} 尺寸 {im.size} != {(expected_w, expected_h)}")
        alpha = im.convert("RGBA").getchannel("A")
        lo, hi = alpha.getextrema()
        if hi == 0:
            errors.append(f"{label}: {rel} 完全透明")
        if lo == 255:
            errors.append(f"{label}: {rel} 没有透明像素（导出时可能丢了透明背景）")


def main() -> int:
    incidents = load(DATA / "incidents.json")
    avatars = load(DATA / "avatars.json")
    stories = load(DATA / "stories.json")
    groups_doc = load(DATA / "groups.json")
    actions_doc = load(DATA / "actions.json")
    items_doc = load(DATA / "items.json")
    rig = load(DATA / "rig.json")

    check_schema("incident", incidents, KIT / "schemas" / "incident.schema.json")
    check_schema("avatar", avatars, KIT / "schemas" / "avatar.schema.json")

    item_map = {item["id"]: item for item in items_doc["items"]}
    group_ids = {group["id"] for group in groups_doc["groups"]}
    user_ids = {avatar["equipped"].get("outfit") for avatar in avatars}  # 仅在下方做装备一致性
    del user_ids

    # 故事不变量
    seen_story_ids = set()
    for story in stories:
        sid = story["id"]
        if sid in seen_story_ids:
            errors.append(f"story: id 重复 {sid}")
        seen_story_ids.add(sid)
        if not (1 <= len(story["title"]) <= 24):
            errors.append(f"story {sid}: 标题长度 {len(story['title'])} 不在 1–24")
        if not (1 <= len(story["body"]) <= 140):
            errors.append(f"story {sid}: 正文长度 {len(story['body'])} 不在 1–140")
        visibility = story.get("visibility")
        if visibility not in {"groups", "self"}:
            errors.append(f"story {sid}: visibility 非法（{visibility}）")
        if visibility == "self":
            if story["visibilityGroupIds"]:
                errors.append(f"story {sid}: 仅自己可见的故事不应带可见圈子")
        else:
            if not story["visibilityGroupIds"]:
                errors.append(f"story {sid}: 必须显式选择可见圈子或标记为仅自己可见")
        for gid in story["visibilityGroupIds"]:
            if gid not in group_ids:
                errors.append(f"story {sid}: 可见圈子 {gid} 不存在")
        if story["tone"] not in {"humorous", "supportive", "neutral"}:
            errors.append(f"story {sid}: tone 非法")
        if story["moderationStatus"] not in {"pending", "approved", "rejected", "hidden"}:
            errors.append(f"story {sid}: moderationStatus 非法")
        if story["publishStatus"] not in {"draft", "published", "withdrawn"}:
            errors.append(f"story {sid}: publishStatus 非法")

    # 成员关系
    memberships = groups_doc["memberships"]
    for m in memberships:
        if m["groupId"] not in group_ids:
            errors.append(f"membership: 圈子不存在 {m['groupId']}")
    for group in groups_doc["groups"]:
        owners = [m for m in memberships if m["groupId"] == group["id"] and m["role"] == "owner" and m["status"] == "active"]
        if len(owners) != 1:
            errors.append(f"group {group['id']}: 活跃圈主数量为 {len(owners)}，应为 1")
        if owners and owners[0].get("userId") != group["ownerId"]:
            errors.append(f"group {group['id']}: ownerId 与成员关系不一致")

    # 动作配置
    action_ids = [a["id"] for a in actions_doc["actions"]]
    if len(action_ids) != len(set(action_ids)):
        errors.append("actions: id 重复")
    for action in actions_doc["actions"]:
        for field in ("id", "name", "assetKey", "durationMs", "requiresFunnyConsent", "requiresGift", "maxPerActorPerStoryPerDay", "fallbackEmoji"):
            if field not in action:
                errors.append(f"action {action.get('id')}: 缺少字段 {field}")
        if not (100 <= action["durationMs"] <= 5000):
            errors.append(f"action {action['id']}: durationMs 超出 100–5000")
        if not (1 <= action["maxPerActorPerStoryPerDay"] <= 10):
            errors.append(f"action {action['id']}: 每日上限不合理")

    # 道具与背包
    item_ids = [item["id"] for item in items_doc["items"]]
    if len(item_ids) != len(set(item_ids)):
        errors.append("items: id 重复")
    rig_slots = {}
    for view, layers in rig["views"].items():
        for layer in layers:
            if "variants" in layer:
                rig_slots.setdefault(layer["slot"], {})[view] = set(layer["variants"].keys())

    for item in items_doc["items"]:
        if item["category"] not in {"cosmetic", "consumable", "badge"}:
            errors.append(f"item {item['id']}: category 非法")
        if item["category"] == "cosmetic":
            if not item["permanent"] or item["transferable"]:
                errors.append(f"item {item['id']}: 外观装扮应永久拥有且不可转让")
            slot = item.get("slot")
            if slot not in rig_slots:
                errors.append(f"item {item['id']}: slot {slot} 在 rig 中不存在")
            else:
                for view in ("front", "back"):
                    if item["id"] not in rig_slots[slot].get(view, set()):
                        errors.append(f"item {item['id']}: 缺少 {view} 图层变体")
        if item["category"] == "consumable":
            if item["permanent"] or not item["transferable"]:
                errors.append(f"item {item['id']}: 互动道具应可转让且非永久")
            if not item.get("ttlDays"):
                errors.append(f"item {item['id']}: 互动道具需要 ttlDays")
            check_png(f"/assets/items/{item['id']}.png", 96, 96, f"item {item['id']}")

    grant = items_doc["weeklyGrant"]
    if not (1 <= grant["count"] <= len(grant["pool"])):
        errors.append("weeklyGrant: count 超出可选范围")
    for item_id in grant["pool"]:
        item = item_map.get(item_id)
        if not item or item["category"] != "consumable":
            errors.append(f"weeklyGrant: {item_id} 不是可发放的互动道具")

    # 角色装备必须能在 rig 中找到对应图层
    for index, avatar in enumerate(avatars):
        for slot, value in avatar["equipped"].items():
            if value is None:
                continue
            item = item_map.get(value)
            if not item:
                errors.append(f"avatar[{index}]: 装备 {value} 不在道具表中")
                continue
            if item.get("slot") != slot:
                errors.append(f"avatar[{index}]: 装备 {value} 的 slot 不是 {slot}")
            if "variants" in next((l for l in rig["views"]["front"] if l.get("slot") == slot), {}):
                if value not in rig_slots.get(slot, {}).get("front", set()):
                    errors.append(f"avatar[{index}]: {slot}={value} 缺少正面图层")

    # 素材完整性
    for view, layers in rig["views"].items():
        for layer in layers:
            bbox = layer["bbox"]
            sources = layer["variants"].values() if "variants" in layer else [layer["src"]]
            for src in sources:
                check_png(src, bbox["w"] * 2, bbox["h"] * 2, f"{view}/{layer['id']}")

    for kind in ("atlas", "avatar", "inbox"):
        for state in ("normal", "active"):
            check_png(f"/assets/tabbar/{kind}-{state}.png", 81, 81, f"tabbar {kind}-{state}")

    # 热点唯一性 / 画布范围
    for view, spots in rig["hotspots"].items():
        ids = [s["id"] for s in spots]
        if len(ids) != len(set(ids)):
            errors.append(f"hotspots {view}: id 重复")
        if not (10 <= len(spots) <= 12):
            errors.append(f"hotspots {view}: 数量 {len(spots)} 不在 10–12")
        for spot in spots:
            if not (spot["r"] <= spot["x"] <= rig["canvas"]["width"] - spot["r"]):
                errors.append(f"hotspots {view}/{spot['id']}: x 超出画布")
            if not (spot["r"] <= spot["y"] <= rig["canvas"]["height"] - spot["r"]):
                errors.append(f"hotspots {view}/{spot['id']}: y 超出画布")

    if errors:
        print(f"校验失败（{len(errors)} 项）：")
        for error in errors:
            print(" -", error)
        return 1
    print(
        "校验通过："
        f"{len(incidents)} 条 incident、{len(avatars)} 个 avatar、{len(stories)} 条 story、"
        f"{len(action_ids)} 个动作、{len(item_ids)} 件道具、{sum(len(v) for v in rig['views'].values())} 个图层。"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
