#input_type_name: StartIntakeInput
#output_type_name: StartIntakeResult
#function_name: start_intake

# The one door. Chat writes here; the app writes here. A DATASTORE schedule on
# intake_jobs wakes the pod assistant. Neither entry point owns a pipeline of
# its own, so neither can drift from the other.

import re
from urllib.parse import urlparse

from pydantic import BaseModel

from lemma_sdk import FunctionContext, Pod


class StartIntakeInput(BaseModel):
    # A URL for source_kind "website", or a pod folder path for "files".
    source_ref: str
    source_kind: str = "website"
    # Omit to let the domain name it; pass it when the person said the name.
    name: str = ""
    # Pass to re-sync an existing brand instead of creating a second one.
    brand_id: str = ""


class StartIntakeResult(BaseModel):
    brand_id: str
    job_id: str
    slug: str
    created_brand: bool


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return (slug or "brand")[:60]


def _name_from(source_ref: str) -> tuple[str, str]:
    """A readable name and slug from a URL, before anyone has told us better."""
    candidate = source_ref if "://" in source_ref else f"https://{source_ref}"
    host = urlparse(candidate).netloc or source_ref
    host = host.removeprefix("www.")
    stem = host.split(".")[0] if "." in host else host
    return stem.replace("-", " ").title(), _slugify(stem)


async def start_intake(ctx: FunctionContext, data: StartIntakeInput) -> StartIntakeResult:
    pod = Pod.from_env()
    brands = pod.table("brands")

    display_name, slug = _name_from(data.source_ref)
    if data.name.strip():
        display_name = data.name.strip()
        slug = _slugify(display_name)

    created_brand = False
    brand_id = data.brand_id.strip()
    if brand_id:
        # A re-sync: keep the brand ready and visible while the scout works, so
        # the team is never left without a brand mid-refresh.
        brands.update(brand_id, {"status": "extracting"})
        existing = brands.get(brand_id)
        slug = existing.get("slug", slug)
    else:
        brand = brands.create(
            {
                "name": display_name,
                "slug": slug,
                "website_url": data.source_ref if data.source_kind == "website" else "",
                "status": "extracting",
                "source_kind": data.source_kind,
                "root_path": f"/brands/{slug}",
                # The first brand in an empty pod is the default one.
                # list() returns a typed response (.items); create/get/update
                # return plain dicts. The first brand in an empty pod is the default.
                "is_default": len(brands.list(limit=1).items) == 0,
            }
        )
        brand_id = brand["id"]
        created_brand = True

    job = pod.table("intake_jobs").create(
        {
            "brand_id": brand_id,
            "source_kind": data.source_kind,
            "source_ref": data.source_ref,
            "status": "queued",
            "activity": "Queued — waiting for the assistant",
        }
    )

    return StartIntakeResult(
        brand_id=brand_id, job_id=job["id"], slug=slug, created_brand=created_brand
    )
