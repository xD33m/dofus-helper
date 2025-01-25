import json

def merge_and_filter_translations(german_file, french_file, items_file, output_file):
    # 1. Read the German JSON
    with open(german_file, 'r', encoding='utf-8') as f:
        german_data = json.load(f)
        
    # 2. Read the French JSON
    with open(french_file, 'r', encoding='utf-8') as f:
        french_data = json.load(f)
        
    # 3. Read items data
    with open(items_file, 'r', encoding='utf-8') as f:
        items_data = json.load(f)

    # 4. Extract the "entries" from each
    german_entries = german_data["entries"]
    french_entries = french_data["entries"]

    # 5. Build a dictionary that maps name-id -> icon-id from the items
    #    (Items are in an array, so we iterate over them.)
    #
    #    Note: Convert name-id to a string so we can match it against the
    #    string keys in the "entries" dictionaries.
    name_id_to_icon = {
        str(item["name-id"]): item["icon-id"]
        for item in items_data
        if "name-id" in item and "icon-id" in item and item["icon-id"] != 0
    }

    # 6. Merge German and French entries into one structure
    #    Here we assume every ID in German_entries also exists in French_entries.
    #    If that’s not guaranteed, you could add checks or continue if key is missing.
    combined_entries = {}
    for entry_id in german_entries:
        if entry_id in french_entries:
            combined_entries[entry_id] = {
                "de": german_entries[entry_id],
                "fr": french_entries[entry_id]
            }

    # 7. Filter out (and augment) only those translations that match an item "name-id"
    filtered_entries = {}
    for entry_id, translation_obj in combined_entries.items():
        if entry_id in name_id_to_icon:
            # Insert the icon-id for this item into the translation object
            translation_obj["icon"] = name_id_to_icon[entry_id]
            filtered_entries[entry_id] = translation_obj
    # Anything that doesn't appear as a "name-id" is discarded

    # 8. Construct the final merged data
    merged_data = {
        "entries": filtered_entries,
        "languages": ["de", "fr"]
    }

    # 9. Write the merged structure to a new JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged_data, f, ensure_ascii=False, separators=(',', ':'))

    print(f"Merged & filtered JSON saved to {output_file}")


if __name__ == "__main__":
    # Example usage (replace with your actual file paths)
    merge_and_filter_translations(
        german_file="de.i18n.json",
        french_file="fr.i18n.json",
        items_file="items.json",
        output_file="frontend/src/assets/de-fr.i18n.json"
    )
