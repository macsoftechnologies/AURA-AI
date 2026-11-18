from langchain_text_splitters import RecursiveCharacterTextSplitter

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=64,
    separators=["\n\n", "\n", "। ", ". ", " ", ""],  # Includes Indian punctuation '।'
    length_function=len,
)


def chunk_extracted_pages(pages: list[dict]) -> list[dict]:
    chunks = []
    chunk_idx = 0
    for page in pages:
        splits = text_splitter.split_text(page["text"])
        for split in splits:
            cleaned = split.strip()
            if cleaned:
                chunks.append({
                    "chunk_index": chunk_idx,
                    "page_number": page["page"],
                    "chunk_text": cleaned,
                })
                chunk_idx += 1
    return chunks