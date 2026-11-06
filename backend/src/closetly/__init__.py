from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("closetly")
except PackageNotFoundError:  # 未安装（直接从源码目录运行）
    __version__ = "0.0.0+unknown"
