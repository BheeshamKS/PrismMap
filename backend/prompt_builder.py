def build_prompt(
    bug_description: str,
    top_files: list[dict],
    total_file_count: int,
    repo_url: str,
    max_chars: int,
) -> tuple[str, int]:
    file_sections = []
    total_chars = 0

    for f in top_files:
        content = f.get("content", "[could not read file]")
        header = f"\n### {f['path']} (relevance: {f['score']:.2f})\n"
        section = f"{header}```\n{content}\n```\n"

        if total_chars + len(section) > max_chars:
            remaining = max_chars - total_chars - len(header) - 20
            if remaining > 100:
                section = f"{header}```\n{content[:remaining]}\n... [truncated]\n```\n"
                file_sections.append(section)
            break

        file_sections.append(section)
        total_chars += len(section)

    files_str = "".join(file_sections)
    shown = len(file_sections)

    prompt = (
        "You are a senior engineer helping debug the following issue.\n\n"
        f"Repository: {repo_url}\n"
        f"Bug: {bug_description}\n\n"
        f"Below are the {shown} most relevant files (of {total_file_count} total), "
        "ranked by relevance score:\n"
        f"{files_str}\n"
        "Identify the root cause, cite the specific file and line number, "
        "and provide a concrete code fix."
    )

    token_estimate = len(prompt) // 4
    return prompt, token_estimate
