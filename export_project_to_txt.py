#!/usr/bin/env python3
"""
Export Project to TXT

This script reads the entire project, respects .gitignore patterns,
and exports all file contents to a single .txt file for context collection.

Usage:
    python export_project_to_txt.py [output_filename]

If no output filename is provided, defaults to 'project_export.txt'
"""

import os
import sys
import fnmatch
from pathlib import Path
from datetime import datetime


WINDOWS_RESERVED_NAMES = {
    'CON', 'PRN', 'AUX', 'NUL',
    *(f'COM{i}' for i in range(1, 10)),
    *(f'LPT{i}' for i in range(1, 10)),
}


def is_windows_reserved_path(path: str) -> bool:
    """
    Check whether a path resolves to a reserved Windows device name.
    """
    if os.name != 'nt':
        return False

    name = os.path.basename(os.path.normpath(path))
    stem = name.split('.')[0].rstrip(' .').upper()
    return stem in WINDOWS_RESERVED_NAMES


def parse_gitignore(gitignore_path: str) -> list[str]:
    """
    Parse .gitignore file and return a list of patterns.
    Handles comments, blank lines, and negation patterns.
    """
    patterns = []
    
    if not os.path.exists(gitignore_path):
        print(f"Warning: {gitignore_path} not found. No patterns will be ignored.")
        return patterns
    
    with open(gitignore_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue
            # Add the pattern
            patterns.append(line)
    
    return patterns


def should_ignore(path: str, patterns: list[str], root_dir: str) -> bool:
    """
    Check if a path should be ignored based on gitignore patterns.
    
    Args:
        path: The file or directory path to check
        patterns: List of gitignore patterns
        root_dir: The root directory of the project
    
    Returns:
        True if the path should be ignored, False otherwise
    """
    if is_windows_reserved_path(path):
        return True

    # Get relative path from root
    try:
        rel_path = os.path.relpath(path, root_dir)
    except ValueError:
        # Skip weird Windows device/mount paths like \\.\nul
        return True

    # Normalize path separators
    rel_path_normalized = rel_path.replace('\\', '/')
    
    # Get the basename
    basename = os.path.basename(os.path.normpath(path))
    
    # Check if it's a directory
    is_dir = os.path.isdir(path)
    
    for pattern in patterns:
        
        # Handle negation (we'll skip negation for simplicity in this implementation)
        if pattern.startswith('!'):
            continue
        
        # Remove leading slash (it means relative to root)
        if pattern.startswith('/'):
            pattern = pattern[1:]
            # Pattern must match from root
            if fnmatch.fnmatch(rel_path_normalized, pattern):
                return True
            if fnmatch.fnmatch(rel_path_normalized, pattern.rstrip('/') + '/**'):
                return True
            continue
        
        # Handle directory-specific patterns (ending with /)
        if pattern.endswith('/'):
            pattern = pattern.rstrip('/')
            if is_dir:
                if fnmatch.fnmatch(basename, pattern):
                    return True
                if fnmatch.fnmatch(rel_path_normalized, pattern):
                    return True
                if fnmatch.fnmatch(rel_path_normalized, '**/' + pattern):
                    return True
        
        # Handle ** patterns (match any directory depth)
        if '**' in pattern:
            if fnmatch.fnmatch(rel_path_normalized, pattern):
                return True
            # Check each component
            parts = rel_path_normalized.split('/')
            for i in range(len(parts)):
                partial = '/'.join(parts[i:])
                if fnmatch.fnmatch(partial, pattern.lstrip('*/')):
                    return True
        
        # Standard pattern matching
        # Match against basename
        if fnmatch.fnmatch(basename, pattern):
            return True
        
        # Match against relative path
        if fnmatch.fnmatch(rel_path_normalized, pattern):
            return True
        
        # Match pattern anywhere in path
        if fnmatch.fnmatch(rel_path_normalized, '**/' + pattern):
            return True
        
        # Check if any parent directory matches
        parts = rel_path_normalized.split('/')
        for i in range(len(parts)):
            partial = '/'.join(parts[:i+1])
            if fnmatch.fnmatch(parts[i], pattern.rstrip('/')):
                return True
    
    return False


def is_binary_file(filepath: str) -> bool:
    """
    Check if a file is binary by reading the first few bytes.
    """
    try:
        with open(filepath, 'rb') as f:
            chunk = f.read(8192)
            # Check for null bytes which indicate binary
            if b'\x00' in chunk:
                return True
            # Try to decode as utf-8
            try:
                chunk.decode('utf-8')
                return False
            except UnicodeDecodeError:
                return True
    except Exception:
        return True


def get_file_content(filepath: str) -> str | None:
    """
    Get the content of a file if it's a text file.
    Returns None for binary files.
    """
    if is_binary_file(filepath):
        return None
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    except Exception as e:
        return f"[Error reading file: {e}]"


def export_project(root_dir: str, output_file: str):
    """
    Export the entire project to a single text file.
    
    Args:
        root_dir: The root directory of the project
        output_file: The output file path
    """
    # Parse .gitignore
    gitignore_path = os.path.join(root_dir, '.gitignore')
    patterns = parse_gitignore(gitignore_path)
    
    # Add default patterns to always ignore
    default_ignore = [
        '.git',
        '.git/**',
        '__pycache__',
        '__pycache__/**',
        '*.pyc',
        '.env',
        '.env.*',
        'node_modules',
        'node_modules/**',
        '*.lock',
        'package-lock.json',
        'pubspec.lock',
        os.path.basename(output_file),
    ]
    patterns.extend(default_ignore)
    
    # Collect all files
    files_to_export = []
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Filter out ignored directories (modify in place)
        dirnames[:] = [d for d in dirnames if not should_ignore(
            os.path.join(dirpath, d), patterns, root_dir
        )]
        
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            
            if not should_ignore(filepath, patterns, root_dir):
                rel_path = os.path.relpath(filepath, root_dir)
                files_to_export.append((rel_path, filepath))
    
    # Sort files by path for consistent output
    files_to_export.sort(key=lambda x: x[0].lower())
    
    # Write to output file
    with open(output_file, 'w', encoding='utf-8') as out:
        # Write header
        out.write("=" * 80 + "\n")
        out.write(f"PROJECT EXPORT\n")
        out.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        out.write(f"Root: {os.path.basename(root_dir)}\n")
        out.write(f"Total files: {len(files_to_export)}\n")
        out.write("=" * 80 + "\n\n")
        
        # Write table of contents
        out.write("TABLE OF CONTENTS\n")
        out.write("-" * 40 + "\n")
        for rel_path, _ in files_to_export:
            out.write(f"  {rel_path}\n")
        out.write("\n" + "=" * 80 + "\n\n")
        
        # Write file contents
        for rel_path, filepath in files_to_export:
            out.write("\n")
            out.write("─" * 80 + "\n")
            out.write(f"FILE: {rel_path}\n")
            out.write("─" * 80 + "\n")
            
            content = get_file_content(filepath)
            if content is None:
                out.write("[Binary file - content not included]\n")
            else:
                out.write(content)
                # Ensure file ends with newline
                if not content.endswith('\n'):
                    out.write('\n')
        
        out.write("\n" + "=" * 80 + "\n")
        out.write("END OF EXPORT\n")
        out.write("=" * 80 + "\n")
    
    return len(files_to_export)


def main():
    # Determine output filename
    if len(sys.argv) > 1:
        output_filename = sys.argv[1]
    else:
        output_filename = 'project_export.txt'
    
    # Get the directory where the script is run from
    root_dir = os.getcwd()
    output_path = os.path.join(root_dir, output_filename)
    
    print(f"Exporting project from: {root_dir}")
    print(f"Output file: {output_filename}")
    print("Reading .gitignore patterns...")
    
    file_count = export_project(root_dir, output_path)
    
    # Get output file size
    file_size = os.path.getsize(output_path)
    size_str = f"{file_size:,} bytes"
    if file_size > 1024 * 1024:
        size_str = f"{file_size / (1024 * 1024):.2f} MB"
    elif file_size > 1024:
        size_str = f"{file_size / 1024:.2f} KB"
    
    print(f"\n✓ Export complete!")
    print(f"  Files exported: {file_count}")
    print(f"  Output size: {size_str}")
    print(f"  Saved to: {output_filename}")


if __name__ == '__main__':
    main()
