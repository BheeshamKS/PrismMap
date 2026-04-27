def build_prompt(bug_description: str, top_files: list[dict], max_chars: int) -> tuple[str, int]:
    file_sections = []
    total_chars = 0

    for f in top_files:
        content = f.get("content", "[could not read file]")
        header = f"\n### {f['path']}\n"
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

    prompt = (
        "You are a senior engineer helping debug the following issue:\n\n"
        f"Bug: {bug_description}\n\n"
        "Below are the most relevant files from the repository, ranked by relevance:\n"
        f"{files_str}\n"
        "Based on these files, identify the likely root cause and suggest a fix."
    )

    token_estimate = len(prompt) // 4
    return prompt, token_estimate
