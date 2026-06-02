from fastapi import APIRouter

router = APIRouter()


def empty_items_response() -> dict[str, list[object]]:
    return {"items": []}


router.add_api_route("/reports", empty_items_response, methods=["GET"])
