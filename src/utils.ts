import fs from 'fs/promises'
import path from 'path'
import { setFailed } from '@actions/core'
import { gitPostComment } from './git'
import { context } from '@actions/github'

type AdjustedRegex = RegExpExecArray & { groups: {} }

const COMMAND_USAGE = `usage:
\`\`\`
/gpt-translate [input file path] [output file path] [target language]
\`\`\`
`

/**
 * Create files recursively if no directory.
 */
export const createFile = async (
  data: string,
  filePath: string,
): Promise<void> => {
  try {
    await fs.writeFile(filePath, data)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await createFile(data, filePath)
    } else {
      throw err
    }
  }
}

export const isFileExists = async (inputPath: string) => {
  try {
    await fs.stat(inputPath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

export const getCommandParams = async () => {
  const comment = context.payload.comment?.body
  if (!comment) setFailed('Error: Comment could not be retrieved correctly.')

  const regex = /\/(?:gpt-translate|gt)\s+(\S+)\s+(\S+)\s+(\S+)/
  const match = regex.exec(comment)

  await validateCommandChecker(comment, match)

  const [, inputFilePath, outputFilePath, targetLang] = match!
  return { inputFilePath, outputFilePath, targetLang }
}

const validateCommandChecker = async (userCommand, match) => {
  const allowedExtensions = ['md', 'mdx'];

  if (!match || match.length < 4)
    await postError(`Invalid command: \`${userCommand}\`\n${COMMAND_USAGE}`);

  // Check if files have allowed extensions
  const file1Extension = match[1].split('.').pop();
  const file2Extension = match[2].split('.').pop();

  if (!allowedExtensions.includes(file1Extension) || !allowedExtensions.includes(file2Extension)) {
    const errorMessage = `Error: Both files must have one of the following extensions: ${allowedExtensions.join(", ")}.\n` +
                         `Found extensions: File1 - .${file1Extension}, File2 - .${file2Extension}`;
    await postError(errorMessage);
  }
};


export const postError = async (message: string) => {
  await gitPostComment(`❌${message}`)
  setFailed(message)
  process.exit(1)
}

export const isPR = () => {
  const { payload } = context
  return !!payload.issue?.pull_request
}
